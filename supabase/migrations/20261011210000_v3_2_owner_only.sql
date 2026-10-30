-- Version 3.2: the app is for the owner only (owner's request, 11 Oct 2026).
-- Layers:
--   1. Supabase Auth: sign-ups switched off (dashboard / config.toml) – sign-in
--      only for existing accounts, by an 8-digit code.
--   2. This migration: an allowlist of exact email addresses and a "before user
--      created" hook that refuses every other address, even through the admin API.
--   3. Row level security as before: every account sees only its own rows.
-- The allowlist starts with the accounts that exist when this migration runs
-- (production and habits-test: only the owner's account).
--
-- Email change: Supabase Auth changes the address after ONE code (old or new)
-- – found in testing – so a stolen, signed-in phone alone could move the
-- account. Therefore the address may only change to an allowlisted one, and a
-- new address gets on the list only from a session that was signed in with a
-- code from the CURRENT address in the last 10 minutes (allow_email_change).

create table private.allowed_emails (
  email text primary key check (email = lower(email) and email like '%_@_%'),
  -- empty = an account address; a time = a planned new address (email change), valid until then
  pending_until timestamptz,
  added_at timestamptz not null default now()
);
comment on table private.allowed_emails is 'v3.2: the only email addresses that may have an account (exact, lower case); pending_until = new address during an email change.';

insert into private.allowed_emails (email)
select lower(email) from auth.users where email is not null
on conflict do nothing;

-- Auth hook "before user created": runs inside Supabase Auth before any new
-- account is stored (sign-up, admin API, invite). Returns an error for every
-- address that is not on the allowlist.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  address text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if address <> '' and exists (select 1 from private.allowed_emails a where a.email = address and a.pending_until is null) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'This app is private.')
  );
end;
$$;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- Step 1 of an email change, called by the app (Settings → Change email) right
-- after the owner entered a fresh sign-in code sent to the CURRENT address:
-- the session's sign-in methods (JWT claim "amr") must contain "otp" from the
-- last 10 minutes. Then the new address is allowed for 30 minutes.
create or replace function public.allow_email_change(new_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  address text := lower(trim(coalesce(new_email, '')));
  fresh boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
     where m ->> 'method' = 'otp'
       and (m ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 600
  ) into fresh;
  if not fresh then
    raise exception 'confirm with a code from your current address first' using errcode = '42501';
  end if;
  if address !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'not an email address' using errcode = '22023';
  end if;
  delete from private.allowed_emails where pending_until is not null and pending_until < now();
  insert into private.allowed_emails (email, pending_until) values (address, now() + interval '30 minutes')
  on conflict (email) do update set pending_until = excluded.pending_until
    where private.allowed_emails.pending_until is not null;
end;
$$;
revoke all on function public.allow_email_change(text) from public, anon, authenticated, service_role;
grant execute on function public.allow_email_change(text) to authenticated;

-- Every change of an account's address (by the app, the API or the admin
-- API) must go to an allowlisted address – otherwise it is refused.
create or replace function private.guard_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null
     and not exists (
       select 1 from private.allowed_emails a
        where a.email = lower(new.email) and (a.pending_until is null or a.pending_until > now())) then
    raise exception 'This address is not allowed for this app.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger allowed_email_guard
  before update of email on auth.users
  for each row execute function private.guard_email_change();

-- After the change: the new address becomes the account's permanent entry,
-- the old one is removed.
create or replace function private.follow_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    insert into private.allowed_emails (email) values (lower(new.email))
    on conflict (email) do update set pending_until = null;
    if old.email is not null then
      delete from private.allowed_emails where email = lower(old.email);
    end if;
  end if;
  return new;
end;
$$;

create trigger allowed_email_follows_change
  after update of email on auth.users
  for each row execute function private.follow_email_change();

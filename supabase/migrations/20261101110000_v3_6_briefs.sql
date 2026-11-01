-- Version 3.6, step 3: the daily briefs (owner, 1 Nov 2026) – an IBKR
-- morning brief, a Canada jobs brief and a world news brief. Each morning a
-- Claude scheduled task (on the owner's Claude plan) researches one brief and
-- sends it to the Edge Function brief-ingest, which stores it here with
-- store_brief(). Only the latest brief of each kind is kept (owner). The app
-- reads it and marks it as seen (seen_on), which hides the amber dot on all
-- devices. Each brief can be switched off in Settings; brief-ingest then
-- tells the scheduled task to stop at once (brief_context()).
-- Additive only (rollback-safe).

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ibkr', 'jobs', 'world')),
  -- the owner's calendar day the brief was made for
  for_day date not null,
  -- { intro, note, summary, tickers, quiet, sections: [{ heading, items: [{ headline, why, url, source }] }] }
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 65536),
  -- the day the owner first opened it (empty = not opened since it arrived)
  seen_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);
comment on table public.briefs is 'v3.6: the latest daily brief of each kind (ibkr, jobs, world), written by brief-ingest.';

create trigger briefs_touch before update on public.briefs
  for each row execute function private.touch_updated_at();
create trigger briefs_broadcast after insert or update or delete on public.briefs
  for each row execute function private.broadcast_change();

alter table public.briefs enable row level security;
create policy "Read own briefs" on public.briefs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Mark own briefs as seen" on public.briefs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The app may only read briefs and set seen_on – the content comes from the server.
revoke all on table public.briefs from public, anon, authenticated, service_role;
grant select on table public.briefs to authenticated;
grant update (seen_on) on table public.briefs to authenticated;

-- The on/off switches (Settings → Daily briefs); all on to start with.
alter table public.user_settings
  add column brief_ibkr_on boolean not null default true,
  add column brief_jobs_on boolean not null default true,
  add column brief_world_on boolean not null default true;
comment on column public.user_settings.brief_ibkr_on is 'v3.6: IBKR morning brief on (Tuesday–Saturday).';
comment on column public.user_settings.brief_jobs_on is 'v3.6: Canada jobs brief on (every day).';
comment on column public.user_settings.brief_world_on is 'v3.6: world news brief on (every day).';

-- ---------------------------------------------------------------------------
-- The owner account (the app is owner-only, v3.2: the single account on the
-- allowlist), as for store_portfolio_snapshot and store_garmin_data.
create or replace function private.brief_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owners uuid[];
begin
  select array_agg(u.id) into owners
    from auth.users u
    join private.allowed_emails a on a.email = lower(u.email)
   where a.pending_until is null;
  if coalesce(array_length(owners, 1), 0) <> 1 then
    raise exception 'briefs: expected exactly one owner account, found %', coalesce(array_length(owners, 1), 0);
  end if;
  return owners[1];
end;
$$;
revoke all on function private.brief_owner() from public, anon, authenticated, service_role;

-- What a scheduled task needs before it starts: the owner's day and time
-- zone, the three switches and – for the IBKR brief – the holdings of the
-- newest IBKR report: symbol, name and type only, never quantities or values.
-- Only the server (brief-ingest) may call it.
create or replace function public.brief_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner uuid := private.brief_owner();
  zone text;
  settings record;
  snapshot record;
begin
  select coalesce(s.time_zone, 'UTC') as time_zone, coalesce(s.brief_ibkr_on, true) as ibkr,
         coalesce(s.brief_jobs_on, true) as jobs, coalesce(s.brief_world_on, true) as world
    into settings
    from (select 1) one
    left join public.user_settings s on s.user_id = owner;
  zone := settings.time_zone;
  select p.id, p.as_of into snapshot
    from public.portfolio_snapshots p
   where p.user_id = owner
   order by p.as_of desc
   limit 1;
  return jsonb_build_object(
    'today', (now() at time zone zone)::date,
    'time_zone', zone,
    'on', jsonb_build_object('ibkr', settings.ibkr, 'jobs', settings.jobs, 'world', settings.world),
    'holdings_as_of', snapshot.as_of,
    'holdings', coalesce((
      select jsonb_agg(jsonb_build_object('symbol', pos.symbol, 'description', pos.description, 'asset_class', pos.asset_class) order by pos.value_base desc nulls last)
        from public.portfolio_positions pos
       where pos.snapshot_id = snapshot.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.brief_context() from public, anon, authenticated;
grant execute on function public.brief_context() to service_role;

-- Stores the owner's brief of one kind for today (their time zone), replacing
-- the previous one (only the latest is kept) and clearing "seen", so the
-- amber dot shows. `content` is checked and trimmed by brief-ingest first.
create or replace function public.store_brief(brief_kind text, content jsonb)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := private.brief_owner();
  zone text;
  day date;
begin
  select coalesce((select s.time_zone from public.user_settings s where s.user_id = owner), 'UTC') into zone;
  day := (now() at time zone zone)::date;
  insert into public.briefs as b (user_id, kind, for_day, content, seen_on)
  values (owner, brief_kind, day, content, null)
  on conflict (user_id, kind) do update set
    for_day = excluded.for_day,
    content = excluded.content,
    seen_on = null;
  return day;
end;
$$;
revoke all on function public.store_brief(text, jsonb) from public, anon, authenticated;
grant execute on function public.store_brief(text, jsonb) to service_role;

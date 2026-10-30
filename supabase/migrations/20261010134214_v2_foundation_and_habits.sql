-- Version 2, part 1: shared building blocks, habits and user settings.
--
-- Rules used for every table in this and the following migrations:
--   * one row per item, each row carries user_id (the owner)
--   * row level security on, "own rows only", explicit grants, no access for anon
--   * child rows reference their parent with (parent_id, user_id), so a row can
--     never hang under another user's item
--   * every change is broadcast to the private Realtime topic "user:<user id>"

-- ---------------------------------------------------------------------------
-- Nothing new in public is reachable through the Data API unless granted here.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

-- Helper functions live in a schema the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Keeps updated_at current on every update.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Sends each row change to the owner's private Realtime topic. The app listens
-- on "user:<own id>" and reloads the affected table.
-- security definer: realtime.broadcast_changes writes to realtime.messages,
-- which normal users may not write to directly.
create or replace function private.broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'user:' || coalesce(new.user_id, old.user_id)::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

-- Each signed-in user may only receive messages on their own topic.
create policy "Users receive their own changes"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Habits
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null check (char_length(emoji) between 1 and 16),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- target for the composite foreign key of habit_completions
  unique (id, user_id)
);
comment on table public.habits is 'A habit to check off each day (v2, one row per habit).';
create index habits_user_id_idx on public.habits (user_id);

-- One row = this habit was done on this day (the user's local calendar day).
create table public.habit_completions (
  habit_id uuid not null,
  day date not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (habit_id, day),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);
comment on table public.habit_completions is 'One row per habit and day it was done.';
create index habit_completions_user_day_idx on public.habit_completions (user_id, day);

-- ---------------------------------------------------------------------------
-- Settings (one row per user; notification preferences used from part 3 on)
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 64),
  inapp_on boolean not null default true,
  email_on boolean not null default false,
  default_remind_time time not null default '09:00',
  quiet_start time,
  quiet_end time,
  updated_at timestamptz not null default now(),
  -- quiet hours are either fully set or not at all
  check ((quiet_start is null) = (quiet_end is null))
);
comment on table public.user_settings is 'Per-user settings: time zone and reminder preferences.';

-- ---------------------------------------------------------------------------
-- Triggers
create trigger habits_touch before update on public.habits
  for each row execute function private.touch_updated_at();
create trigger user_settings_touch before update on public.user_settings
  for each row execute function private.touch_updated_at();

create trigger habits_broadcast after insert or update or delete on public.habits
  for each row execute function private.broadcast_change();
create trigger habit_completions_broadcast after insert or update or delete on public.habit_completions
  for each row execute function private.broadcast_change();
create trigger user_settings_broadcast after insert or update or delete on public.user_settings
  for each row execute function private.broadcast_change();

-- ---------------------------------------------------------------------------
-- Row level security and grants
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.user_settings enable row level security;

create policy "Own habits" on public.habits for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own habit completions" on public.habit_completions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own settings" on public.user_settings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.habits, public.habit_completions, public.user_settings
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.habits to authenticated;
grant select, insert, delete on table public.habit_completions to authenticated;
grant select, insert, update on table public.user_settings to authenticated;
-- the reminder function reads settings with the service role (part 3)
grant select on table public.user_settings to service_role;

-- ---------------------------------------------------------------------------
-- "Delete my account": removes the user; every table above cascades.
-- security definer because only the database owner may delete from auth.users;
-- it can only ever delete the caller's own account.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon, authenticated, service_role;
grant execute on function public.delete_my_account() to authenticated;

-- Version 3, increment 4: a daily reminder per habit (design v3 §5.2, owner
-- decision D3): at a time of day, in the user's time zone, only if the habit
-- isn't ticked yet that day – at most once a day. Same channels, quiet hours
-- and retry rules as task reminders.
-- Additive only.

-- ---------------------------------------------------------------------------
-- A time zone name the database knows, or UTC (one wrong name must never
-- stop the reminders of everybody else).
create or replace function private.safe_time_zone(zone text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select name from pg_catalog.pg_timezone_names where name = zone limit 1), 'UTC');
$$;

-- "Now" on the user's wall clock.
create or replace function private.local_now(owner uuid)
returns timestamp
language sql
stable
set search_path = ''
as $$
  select now() at time zone private.safe_time_zone(
    (select s.time_zone from public.user_settings s where s.user_id = owner));
$$;

-- ---------------------------------------------------------------------------
create table public.habit_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  remind_time time not null,
  channels text[] not null default array['inapp', 'push']
    check (cardinality(channels) between 1 and 3 and channels <@ array['inapp', 'push', 'email']),
  active boolean not null default true,
  -- server side: the user's local day of the last finished reminder, the
  -- tries for the current day, a running send and the next retry
  last_sent_on date,
  attempts integer not null default 0,
  claimed_at timestamptz,
  retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade,
  -- one reminder per habit; with user_id, so another user can't learn from a
  -- "duplicate" error that a habit id exists (see v2 Step 61)
  unique (habit_id, user_id)
);
comment on table public.habit_reminders is 'Daily reminder of a habit (v3): sent once a day at remind_time if the habit is not done.';
create index habit_reminders_user_id_idx on public.habit_reminders (user_id);

-- When the *user* creates or changes a reminder, its time today may already
-- have passed: then it starts tomorrow (nothing fires at once). The server's
-- own updates (service role) are left alone.
-- security definer: it reads the user's time zone through the private helper
-- functions, which normal users can't call; it only changes the row itself.
create or replace function private.prepare_habit_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  local timestamp := private.local_now(new.user_id);
begin
  if tg_op = 'INSERT'
     or (session_user <> 'service_role' and current_setting('role', true) <> 'service_role'
         and (new.remind_time is distinct from old.remind_time
              or new.channels is distinct from old.channels
              or new.active is distinct from old.active)) then
    new.attempts := 0;
    new.claimed_at := null;
    new.retry_at := null;
    if local::time >= new.remind_time and (new.last_sent_on is null or new.last_sent_on < local::date) then
      new.last_sent_on := local::date;
    end if;
  end if;
  return new;
end;
$$;

create trigger habit_reminders_prepare before insert or update on public.habit_reminders
  for each row execute function private.prepare_habit_reminder();
create trigger habit_reminders_touch before update on public.habit_reminders
  for each row execute function private.touch_updated_at();
create trigger habit_reminders_broadcast after insert or update or delete on public.habit_reminders
  for each row execute function private.broadcast_change();

alter table public.habit_reminders enable row level security;
create policy "Own habit reminders" on public.habit_reminders for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.habit_reminders from public, anon, authenticated, service_role;
-- users: only the columns they may set (the sending state is the server's)
grant select, delete on table public.habit_reminders to authenticated;
grant insert (id, user_id, habit_id, remind_time, channels, active) on table public.habit_reminders to authenticated;
grant update (remind_time, channels, active) on table public.habit_reminders to authenticated;
grant select, update on table public.habit_reminders to service_role;
-- the function reads habit names and whether a habit was ticked
grant select on table public.habits, public.habit_completions to service_role;

-- The delivery log can point to a habit too.
alter table public.notification_log add column habit_id uuid;

-- ---------------------------------------------------------------------------
-- Server side: claims up to `max_count` habit reminders that are due now –
-- their time has come today (user's time zone), they weren't sent today, the
-- habit isn't ticked today, no retry is waiting. "for update skip locked":
-- two overlapping runs never get the same reminder; a claim older than 10
-- minutes (crashed run) is taken again.
-- security definer: it uses the private time-zone helpers; only the service
-- role (the Edge Function) may call it.
create or replace function public.claim_due_habit_reminders(max_count integer default 50)
returns table (
  reminder_id uuid,
  user_id uuid,
  habit_id uuid,
  habit_name text,
  habit_emoji text,
  local_day date,
  channels text[],
  attempts integer,
  time_zone text,
  inapp_on boolean,
  email_on boolean,
  quiet_start time,
  quiet_end time
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select r.id, private.local_now(r.user_id)::date as local_day
      from public.habit_reminders r
     where r.active
       and (r.claimed_at is null or r.claimed_at < now() - interval '10 minutes')
       and (r.retry_at is null or r.retry_at <= now())
       and private.local_now(r.user_id)::time >= r.remind_time
       and (r.last_sent_on is null or r.last_sent_on < private.local_now(r.user_id)::date)
       and not exists (
         select 1 from public.habit_completions c
          where c.habit_id = r.habit_id and c.day = private.local_now(r.user_id)::date)
     order by r.remind_time
     limit max_count
     for update of r skip locked
  ), claimed as (
    update public.habit_reminders r
       set claimed_at = now(), attempts = r.attempts + 1
      from due
     where r.id = due.id
    returning r.*, due.local_day
  )
  select c.id, c.user_id, c.habit_id, h.name, h.emoji, c.local_day, c.channels, c.attempts,
         private.safe_time_zone(s.time_zone), coalesce(s.inapp_on, true), coalesce(s.email_on, false),
         s.quiet_start, s.quiet_end
    from claimed c
    join public.habits h on h.id = c.habit_id
    left join public.user_settings s on s.user_id = c.user_id;
$$;
revoke all on function public.claim_due_habit_reminders(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_due_habit_reminders(integer) to service_role;
revoke all on function private.safe_time_zone(text), private.local_now(uuid) from public, anon;

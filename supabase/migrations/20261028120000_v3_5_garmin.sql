-- Version 3.5: the Garmin card on the Week page (read-only).
-- Daily summaries and activities from the Garmin Connect Personal API,
-- written only by the Edge Function garmin-sync; the app may only read them.
-- Additive only (rollback-safe): the live 3.4 app neither reads nor writes these.

create table public.garmin_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  steps integer,
  step_goal integer,
  -- beats per minute; Garmin sets it once most of the day is recorded
  resting_hr integer,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
comment on table public.garmin_days is 'v3.5: one Garmin daily summary per calendar day (server-written, 365 days).';

create table public.garmin_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Garmin's own activity id
  garmin_id bigint not null,
  -- the local calendar day the activity started on
  day date not null,
  started_at timestamptz,
  -- Garmin's type key, e.g. running, road_biking, strength_training
  activity_type text not null,
  name text,
  distance_m numeric,
  duration_s numeric,
  moving_s numeric,
  created_at timestamptz not null default now(),
  unique (user_id, garmin_id)
);
comment on table public.garmin_activities is 'v3.5: Garmin activities (server-written, 365 days).';
create index garmin_activities_user_day_idx on public.garmin_activities (user_id, day);

create trigger garmin_days_broadcast after insert or update or delete on public.garmin_days
  for each row execute function private.broadcast_change();
create trigger garmin_activities_broadcast after insert or update or delete on public.garmin_activities
  for each row execute function private.broadcast_change();

-- Users may only read their own rows; nobody but the function below writes.
alter table public.garmin_days enable row level security;
alter table public.garmin_activities enable row level security;
create policy "Read own Garmin days" on public.garmin_days for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Read own Garmin activities" on public.garmin_activities for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.garmin_days, public.garmin_activities from public, anon, authenticated, service_role;
grant select on table public.garmin_days, public.garmin_activities to authenticated;
-- garmin-sync reads the newest stored day (first run: fetch a whole year) – lesson of Step 130
grant select on table public.garmin_days to service_role;

-- ---------------------------------------------------------------------------
-- Stores one fetch for the owner (the single allowlisted account, v3.2), in one
-- transaction: each day is upserted (the newest version of a day wins), and the
-- activities of the fetched range are replaced as a whole, so an activity
-- deleted in Garmin Connect disappears here too. Only the server may call it.
--   period:     { from, to }                       (dates, inclusive)
--   days:       [{ day, steps, step_goal, resting_hr }]
--   activities: [{ garmin_id, day, started_at, activity_type, name, distance_m, duration_s, moving_s }]
create or replace function public.store_garmin_data(period jsonb, days jsonb, activities jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  owners uuid[];
  range_from date := (period ->> 'from')::date;
  range_to date := (period ->> 'to')::date;
  stored integer;
begin
  select array_agg(u.id) into owners
    from auth.users u
    join private.allowed_emails a on a.email = lower(u.email)
   where a.pending_until is null;
  if coalesce(array_length(owners, 1), 0) <> 1 then
    raise exception 'store_garmin_data: expected exactly one owner account, found %', coalesce(array_length(owners, 1), 0);
  end if;
  if range_from is null or range_to is null or range_from > range_to then
    raise exception 'store_garmin_data: invalid range';
  end if;

  insert into public.garmin_days as g (user_id, day, steps, step_goal, resting_hr, fetched_at)
  select owners[1], (d ->> 'day')::date, (d ->> 'steps')::integer, (d ->> 'step_goal')::integer,
         (d ->> 'resting_hr')::integer, now()
    from jsonb_array_elements(coalesce(days, '[]'::jsonb)) d
  on conflict (user_id, day) do update set
    steps = excluded.steps,
    step_goal = excluded.step_goal,
    resting_hr = excluded.resting_hr,
    fetched_at = excluded.fetched_at;
  get diagnostics stored = row_count;

  delete from public.garmin_activities a
   where a.user_id = owners[1] and a.day between range_from and range_to;
  insert into public.garmin_activities as a
    (user_id, garmin_id, day, started_at, activity_type, name, distance_m, duration_s, moving_s)
  select owners[1], (x ->> 'garmin_id')::bigint, (x ->> 'day')::date, (x ->> 'started_at')::timestamptz,
         x ->> 'activity_type', x ->> 'name', (x ->> 'distance_m')::numeric,
         (x ->> 'duration_s')::numeric, (x ->> 'moving_s')::numeric
    from jsonb_array_elements(coalesce(activities, '[]'::jsonb)) x
  on conflict (user_id, garmin_id) do update set
    day = excluded.day,
    started_at = excluded.started_at,
    activity_type = excluded.activity_type,
    name = excluded.name,
    distance_m = excluded.distance_m,
    duration_s = excluded.duration_s,
    moving_s = excluded.moving_s;

  return stored;
end;
$$;
revoke all on function public.store_garmin_data(jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.store_garmin_data(jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Scheduler: every 30 minutes (at :07 and :37), the same project address and
-- scheduler token as send-reminders and ibkr-sync. Garmin's limits for the
-- Personal API are not published – change the interval here if needed.
-- `select cron.unschedule('garmin-sync');` stops it.
select cron.schedule(
  'garmin-sync',
  '7,37 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/garmin-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $job$
);

-- Housekeeping once a day: days and activities older than 365 days (owner G7).
select cron.schedule(
  'cleanup-garmin',
  '33 3 * * *',
  $job$
  delete from public.garmin_days where day < current_date - 365;
  delete from public.garmin_activities where day < current_date - 365;
  $job$
);

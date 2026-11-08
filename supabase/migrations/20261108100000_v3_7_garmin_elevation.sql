-- Version 3.7: elevation gain for Garmin activities (owner, 8 Nov 2026).
-- The Garmin window shows the elevation per activity type and per day.
-- Additive only (rollback-safe): the live 3.6 app never reads this column, and
-- the new store_garmin_data accepts the old input (no elevation → null).

alter table public.garmin_activities add column elevation_gain_m numeric;
comment on column public.garmin_activities.elevation_gain_m is 'v3.7: metres climbed during the activity (Garmin''s elevation gain), null when Garmin reports none.';

-- Same as v3.5, plus elevation_gain_m for each activity.
--   activities: [{ garmin_id, day, started_at, activity_type, name, distance_m, duration_s, moving_s, elevation_gain_m }]
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
    (user_id, garmin_id, day, started_at, activity_type, name, distance_m, duration_s, moving_s, elevation_gain_m)
  select owners[1], (x ->> 'garmin_id')::bigint, (x ->> 'day')::date, (x ->> 'started_at')::timestamptz,
         x ->> 'activity_type', x ->> 'name', (x ->> 'distance_m')::numeric,
         (x ->> 'duration_s')::numeric, (x ->> 'moving_s')::numeric, (x ->> 'elevation_gain_m')::numeric
    from jsonb_array_elements(coalesce(activities, '[]'::jsonb)) x
  on conflict (user_id, garmin_id) do update set
    day = excluded.day,
    started_at = excluded.started_at,
    activity_type = excluded.activity_type,
    name = excluded.name,
    distance_m = excluded.distance_m,
    duration_s = excluded.duration_s,
    moving_s = excluded.moving_s,
    elevation_gain_m = excluded.elevation_gain_m;

  return stored;
end;
$$;
revoke all on function public.store_garmin_data(jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.store_garmin_data(jsonb, jsonb, jsonb) to service_role;

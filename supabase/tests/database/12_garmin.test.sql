-- Version 3.5: the Garmin tables – the owner may only read them, only the
-- server function writes them.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into private.allowed_emails (email) values ('owner@test.local');
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'other@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.garmin_days'::regclass), 'RLS is on for garmin_days');
select ok((select relrowsecurity from pg_class where oid = 'public.garmin_activities'::regclass), 'RLS is on for garmin_activities');

-- the server stores two days and two activities for the one owner
select is(
  public.store_garmin_data(
    '{"from": "2026-10-26", "to": "2026-10-27"}',
    '[{"day": "2026-10-26", "steps": 8120, "step_goal": 8000, "resting_hr": 52}, {"day": "2026-10-27", "steps": 4100, "resting_hr": null}]',
    '[{"garmin_id": 101, "day": "2026-10-26", "activity_type": "running", "moving_s": 1800, "duration_s": 1900},
      {"garmin_id": 102, "day": "2026-10-27", "activity_type": "strength_training", "duration_s": 2400}]'
  ),
  2,
  'the server stores two days'
);
select is((select user_id from public.garmin_days where day = '2026-10-26'), '11111111-1111-1111-1111-111111111111'::uuid, 'they belong to the allowlisted owner');
select is((select count(*) from public.garmin_activities), 2::bigint, 'and two activities');

-- the same day again: the newer figures win, one row per day
select lives_ok(
  $$ select public.store_garmin_data(
       '{"from": "2026-10-27", "to": "2026-10-27"}',
       '[{"day": "2026-10-27", "steps": 9300, "resting_hr": 51}]',
       '[]'
     ) $$,
  'a day can be stored again'
);
select is((select count(*) from public.garmin_days where day = '2026-10-27'), 1::bigint, 'one row per day');
select is((select steps from public.garmin_days where day = '2026-10-27'), 9300, 'with the newer steps');
select is((select resting_hr from public.garmin_days where day = '2026-10-27'), 51, 'and the resting heart rate once Garmin has it');

-- activities: the fetched range is replaced as a whole, outside it nothing changes
select is((select count(*) from public.garmin_activities where day = '2026-10-27'), 0::bigint, 'an activity deleted in Garmin disappears from the range');
select is((select count(*) from public.garmin_activities where day = '2026-10-26'), 1::bigint, 'activities outside the range stay');

select throws_ok(
  $$ select public.store_garmin_data('{"from": "2026-10-28", "to": "2026-10-27"}', '[]', '[]') $$,
  'P0001', 'store_garmin_data: invalid range', 'a reversed range is refused'
);

-- the server function may read the days (newest stored day) but not write directly
select ok(has_table_privilege('service_role', 'public.garmin_days', 'select'), 'the server role can read the days');
select ok(not has_table_privilege('service_role', 'public.garmin_days', 'insert'), 'but cannot insert them directly');

-- the owner reads, but cannot write or call the function
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select count(*) from public.garmin_days), 2::bigint, 'the owner sees their days');
select throws_ok(
  $$ insert into public.garmin_days (user_id, day, steps) values ('11111111-1111-1111-1111-111111111111', '2026-10-25', 1) $$,
  '42501', null, 'the owner cannot write days'
);
select throws_ok(
  $$ select public.store_garmin_data('{"from": "2026-10-27", "to": "2026-10-27"}', '[]', '[]') $$,
  '42501', null, 'the owner cannot call the store function'
);

-- someone else sees nothing
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.garmin_days) + (select count(*) from public.garmin_activities), 0::bigint, 'another account sees no Garmin data');

select * from finish();
rollback;

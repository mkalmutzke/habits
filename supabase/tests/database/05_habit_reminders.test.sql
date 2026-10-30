-- Habit reminders (v3): row level security, the user's columns, and which
-- reminders the server claims (test plan v3 TS-R2–R4, R7, R10).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true);
$$;
-- what the Edge Function gets back (as the service role)
create function pg_temp.claim() returns setof uuid language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  return query select reminder_id from public.claim_due_habit_reminders(50)
    where user_id = '11111111-1111-1111-1111-111111111111';
  perform set_config('role', 'postgres', true);
end;
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.habit_reminders'::regclass), 'RLS is on for habit_reminders');

-- A: time zone far east of UTC, a habit with a reminder at 00:00 (always passed today)
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.user_settings (time_zone) values ('Pacific/Kiritimati');
insert into public.habits (id, name, emoji) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Walk Bello', '🐕');
insert into public.habit_reminders (id, habit_id, remind_time, channels)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', '00:00', array['push']);

select is(
  (select starts_on from public.habit_reminders),
  (now() at time zone 'Pacific/Kiritimati')::date + 1,
  'a reminder whose time already passed today starts tomorrow (its local day)'
);
select is((select last_sent_on from public.habit_reminders), null, 'nothing was sent yet (v3.0.3: no "starts tomorrow" mark in last_sent_on)');

-- the owner's case (v3.0.3): moved to a time still to come today → starts today
update public.habit_reminders set remind_time = '23:59';
select is((select starts_on from public.habit_reminders), (now() at time zone 'Pacific/Kiritimati')::date, 'moved to later today → starts today');
update public.habit_reminders set remind_time = '00:00';
select throws_ok(
  $$ update public.habit_reminders set last_sent_on = null $$,
  '42501', null, 'the user cannot change the server''s columns'
);
select throws_ok(
  $$ select * from public.claim_due_habit_reminders(50) $$,
  '42501', null, 'a user cannot call the claim function'
);

-- B sees nothing and can't add a reminder to A's habit
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.habit_reminders), 0::bigint, 'B sees no reminders of A');
select throws_ok(
  $$ insert into public.habit_reminders (habit_id, remind_time) values ('aaaaaaaa-0000-0000-0000-000000000001', '08:00') $$,
  '23503', null, 'B cannot add a reminder to A''s habit'
);

-- the server: not sent yesterday → due now
select pg_temp.as_owner();
select is((select count(*) from pg_temp.claim()), 0::bigint, 'nothing is due before its first day');
update public.habit_reminders set starts_on = (now() at time zone 'Pacific/Kiritimati')::date, last_sent_on = (now() at time zone 'Pacific/Kiritimati')::date - 1 where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select is(array(select pg_temp.claim()), array['aaaaaaaa-0000-0000-0000-0000000000a1'::uuid], 'not sent today and not ticked → claimed');
select is((select attempts from public.habit_reminders where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 1, 'the claim counts as a try');
select is((select count(*) from pg_temp.claim()), 0::bigint, 'a running claim is not taken twice');

-- the server finished: sent today → not again today
update public.habit_reminders set claimed_at = null, attempts = 0, last_sent_on = (now() at time zone 'Pacific/Kiritimati')::date where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select is((select count(*) from pg_temp.claim()), 0::bigint, 'sent today → not claimed again today');

-- the habit is ticked today → nothing to remind of
update public.habit_reminders set last_sent_on = null where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
insert into public.habit_completions (habit_id, user_id, day)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', (now() at time zone 'Pacific/Kiritimati')::date);
select is((select count(*) from pg_temp.claim()), 0::bigint, 'ticked today → not claimed');
delete from public.habit_completions where habit_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- a retry waits for its time; switched off is never claimed
update public.habit_reminders set retry_at = now() + interval '5 minutes' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select is((select count(*) from pg_temp.claim()), 0::bigint, 'a waiting retry is not claimed early');
update public.habit_reminders set retry_at = null, active = false where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select is((select count(*) from pg_temp.claim()), 0::bigint, 'a switched-off reminder is never claimed');

-- an unknown time zone falls back to UTC instead of breaking every reminder
update public.habit_reminders set active = true where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
update public.user_settings set time_zone = 'Mars/Olympus_Mons' where user_id = '11111111-1111-1111-1111-111111111111';
select lives_ok($$ select * from pg_temp.claim() $$, 'an unknown time zone does not break the claim');

-- deleting the habit deletes its reminder
delete from public.habits where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*) from public.habit_reminders where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 0::bigint, 'the reminder goes with its habit');

select * from finish();
rollback;

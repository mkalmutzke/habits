-- Reminders, push subscriptions, delivery log, server functions
-- (test plan TS-N, TS-S1–S4).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(22);

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true),
         set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
$$;

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.todo_reminders'::regclass, 'public.push_subscriptions'::regclass, 'public.notification_log'::regclass)),
  'RLS is on for reminders, push subscriptions and the log'
);

-- A: a task with a reminder that is already due
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.todo_tasks (id, title, due_date, repeat_rule)
  values ('aaaaaaaa-0000-0000-0000-00000000000c', 'Call the dentist', '2026-10-12', '{"freq":"weekly","interval":1}');
select lives_ok(
  $$ insert into public.todo_reminders (id, task_id, remind_at, channels)
     values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000000c', now() - interval '1 minute', array['inapp','push']) $$,
  'A can set a reminder on their task'
);
select throws_ok(
  $$ update public.todo_reminders set status = 'sent' $$,
  '42501', null, 'users cannot write the status (server only)'
);
select throws_ok(
  $$ insert into public.todo_reminders (task_id, remind_at, channels, status)
     values ('aaaaaaaa-0000-0000-0000-00000000000c', now(), array['push'], 'sent') $$,
  '42501', null, 'users cannot insert a status either'
);
select throws_ok(
  $$ update public.todo_reminders set channels = array['sms'] $$,
  '23514', null, 'unknown channels are rejected'
);
select lives_ok(
  $$ insert into public.push_subscriptions (endpoint, p256dh, auth)
     values ('https://fcm.googleapis.com/fcm/send/device-a', repeat('k', 87), repeat('a', 22)) $$,
  'A can register a device for push'
);
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, p256dh, auth)
     values ('http://evil.example/collect', repeat('k', 87), repeat('a', 22)) $$,
  '23514', null, 'push endpoints must be https'
);
select throws_ok(
  $$ insert into public.notification_log (user_id, channel, result) values ('11111111-1111-1111-1111-111111111111', 'push', 'sent') $$,
  '42501', null, 'users cannot write the delivery log'
);
select throws_ok($$ select * from public.claim_due_reminders(10) $$, '42501', null, 'users cannot claim reminders');
select throws_ok($$ select public.check_cron_token('guess') $$, '42501', null, 'users cannot test cron tokens');

-- B sees none of it and cannot attach a reminder to A's task
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.todo_reminders), 0::bigint, 'B sees no reminders of A');
select is((select count(*) from public.push_subscriptions), 0::bigint, 'B sees no devices of A');
select throws_ok(
  $$ insert into public.todo_reminders (task_id, remind_at) values ('aaaaaaaa-0000-0000-0000-00000000000c', now()) $$,
  '23503', null, 'B cannot put a reminder on A''s task'
);

-- the server (service role) claims the due reminder exactly once
select pg_temp.act_as_server();
select is((select count(*) from public.claim_due_reminders(10)), 1::bigint, 'the server claims the due reminder');
select is((select count(*) from public.claim_due_reminders(10)), 0::bigint, 'a claimed reminder is not claimed twice');
select is((select status from public.todo_reminders where id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 'sending', 'it is marked as sending');
select is(public.check_cron_token('wrong'), false, 'a wrong cron token is refused');
update public.todo_reminders set remind_at = now() + interval '5 minutes', status = 'pending'
 where id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
select is((select attempts from public.todo_reminders where id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 1, 'a server retry keeps the attempt count');

-- the user changes the time: due again from scratch
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
update public.todo_reminders set remind_at = now() + interval '1 hour';
select is(
  (select status || '/' || attempts from public.todo_reminders where id = 'aaaaaaaa-0000-0000-0000-0000000000f1'),
  'pending/0', 'a new time from the user resets status and attempts'
);

-- completing the repeating task moves the reminder along with the due date
select lives_ok(
  $$ select public.complete_repeating_task('aaaaaaaa-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-0000000000ee', '2026-10-19') $$,
  'A completes the repeating task'
);
select is(
  (select r2.remind_at - r1.remind_at
     from public.todo_reminders r1, public.todo_reminders r2
    where r1.task_id = 'aaaaaaaa-0000-0000-0000-00000000000c' and r2.task_id = 'aaaaaaaa-0000-0000-0000-0000000000ee'),
  interval '7 days', 'the next task''s reminder is 7 days later'
);

-- the scheduler job exists
set local role postgres;
select is((select count(*) from cron.job where jobname = 'send-reminders' and schedule = '* * * * *'), 1::bigint, 'send-reminders runs every minute');

select * from finish();
rollback;

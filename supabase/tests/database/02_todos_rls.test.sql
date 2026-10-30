-- To-do tables: row level security, composite foreign keys, repeating tasks
-- (test plan TS-S1–S4, TS-T7).
begin;
-- In a cloud project the CLI connects with a temporary login role; the tests
-- act as the database owner (locally they already do). pgTAP lives in the
-- schema "extensions" (the CLI installs it for the run if it's missing).
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.todo_groups'::regclass, 'public.todo_lists'::regclass,
    'public.todo_tasks'::regclass, 'public.todo_steps'::regclass)),
  'RLS is on for all to-do tables'
);

-- A: a group, a list in it, a repeating task with a step, and an inbox task.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.todo_groups (id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Personal');
insert into public.todo_lists (id, group_id, name, color)
  values ('aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Home', 'green');
insert into public.todo_tasks (id, list_id, title, due_date, repeat_rule)
  values ('aaaaaaaa-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-00000000000b', 'Water plants', '2026-10-10', '{"freq":"weekly","interval":1}');
insert into public.todo_steps (task_id, title, done) values ('aaaaaaaa-0000-0000-0000-00000000000c', 'Basil', true);
insert into public.todo_tasks (id, title) values ('aaaaaaaa-0000-0000-0000-00000000000d', 'Inbox task');
select is((select count(*) from public.todo_tasks), 2::bigint, 'A sees their two tasks');

-- B sees nothing and can't attach anything to A's items.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.todo_groups), 0::bigint, 'B sees no groups of A');
select is((select count(*) from public.todo_lists), 0::bigint, 'B sees no lists of A');
select is((select count(*) from public.todo_tasks), 0::bigint, 'B sees no tasks of A');
select is((select count(*) from public.todo_steps), 0::bigint, 'B sees no steps of A');
select throws_ok(
  $$ insert into public.todo_tasks (list_id, title) values ('aaaaaaaa-0000-0000-0000-00000000000b', 'Sneaky') $$,
  '23503', null, 'B cannot add a task to A''s list'
);
select throws_ok(
  $$ insert into public.todo_steps (task_id, title) values ('aaaaaaaa-0000-0000-0000-00000000000c', 'Sneaky') $$,
  '23503', null, 'B cannot add a step to A''s task'
);
select throws_ok(
  $$ insert into public.todo_lists (group_id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Sneaky') $$,
  '23503', null, 'B cannot put a list into A''s group'
);
select throws_ok(
  $$ select public.complete_repeating_task('aaaaaaaa-0000-0000-0000-00000000000c', gen_random_uuid(), '2026-10-17') $$,
  'P0002', null, 'B cannot complete A''s repeating task'
);
update public.todo_tasks set title = 'Hacked';
delete from public.todo_tasks;

-- Back to A: nothing changed; complete the repeating task.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select count(*) from public.todo_tasks where title = 'Hacked'), 0::bigint, 'B''s update changed nothing');
select lives_ok(
  $$ select public.complete_repeating_task('aaaaaaaa-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-0000000000ee', '2026-10-17') $$,
  'A completes the repeating task'
);
select isnt((select completed_at from public.todo_tasks where id = 'aaaaaaaa-0000-0000-0000-00000000000c'), null, 'the old task is done');
select is((select due_date from public.todo_tasks where id = 'aaaaaaaa-0000-0000-0000-0000000000ee'), '2026-10-17'::date, 'the next task is due a week later');
select is(
  (select done from public.todo_steps where task_id = 'aaaaaaaa-0000-0000-0000-0000000000ee'),
  false, 'its step is copied and unticked'
);
select throws_ok(
  $$ select public.complete_repeating_task('aaaaaaaa-0000-0000-0000-00000000000c', gen_random_uuid(), '2026-10-24') $$,
  'P0002', null, 'a task can''t be completed twice'
);
select throws_ok(
  $$ insert into public.todo_tasks (title, repeat_rule) values ('Bad', '{"freq":"hourly"}') $$,
  '23514', null, 'unknown repeat rules are rejected'
);

-- Deleting a group keeps its lists; deleting a list deletes its tasks.
delete from public.todo_groups where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select is((select group_id from public.todo_lists where id = 'aaaaaaaa-0000-0000-0000-00000000000b'), null, 'the list stays, without group');
delete from public.todo_lists where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
select is((select count(*) from public.todo_tasks), 1::bigint, 'only the inbox task is left');

select * from finish();
rollback;

-- Version 3.1: habit subtitle and purge of old completed tasks.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- subtitle
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.habits (id, name, emoji, subtitle) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Gym', '🏃', 'Legs day');
select is((select subtitle from public.habits where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Legs day', 'a habit keeps its subtitle');
insert into public.habits (id, name, emoji) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Walk', '🐕');
select is((select subtitle from public.habits where id = 'aaaaaaaa-0000-0000-0000-000000000002'), '', 'the subtitle is optional (empty)');
select throws_ok($$ insert into public.habits (name, emoji, subtitle) values ('X', '✨', repeat('x', 61)) $$, '23514', null, 'more than 60 characters is refused');

-- purge of tasks completed more than 360 days ago (same statement as the job)
set local role postgres;
select ok(exists (select 1 from cron.job where jobname = 'purge-completed-tasks' and active), 'the purge job is scheduled');
insert into public.todo_tasks (id, user_id, title, completed_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Done long ago', now() - interval '361 days'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Done this year', now() - interval '300 days');
insert into public.todo_tasks (id, user_id, title, created_at) values
  ('bbbbbbbb-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Open for ages', now() - interval '800 days');
delete from public.todo_tasks where completed_at < now() - interval '360 days';
select is((select count(*) from public.todo_tasks where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0::bigint, 'completed more than 360 days ago → gone');
select is((select count(*) from public.todo_tasks where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 1::bigint, 'completed 300 days ago → kept');
select is((select count(*) from public.todo_tasks where id = 'bbbbbbbb-0000-0000-0000-000000000003'), 1::bigint, 'an old open task → kept');

select * from finish();
rollback;

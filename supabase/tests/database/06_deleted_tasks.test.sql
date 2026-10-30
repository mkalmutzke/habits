-- Deleted tasks (v3): kept with deleted_at, reminder not sent, removed for
-- good after 10 days by the daily job (test plan v3 TS-S3, TS-S4).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select is(
  (select column_default from information_schema.columns where table_name = 'user_settings' and column_name = 'show_deleted_tasks'),
  'true', 'deleted tasks are shown by default'
);

-- A: a task with a due reminder, deleted (soft) by the app
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.todo_tasks (id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Cancel gym trial');
insert into public.todo_steps (task_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Call them');
insert into public.todo_reminders (task_id, remind_at, channels)
  values ('aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 minute', array['push']);
update public.todo_tasks set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*) from public.todo_tasks where deleted_at is not null), 1::bigint, 'the deleted task is still there');
update public.todo_tasks set deleted_at = null where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select deleted_at from public.todo_tasks), null, 'and can be restored');
update public.todo_tasks set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- the server: a deleted task counts as done → its reminder is cancelled
select set_config('role', 'service_role', true);
select is((select task_done from public.claim_due_reminders(50) where task_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true, 'a deleted task''s reminder is treated like a done one');
select set_config('role', 'postgres', true);

-- the daily job (same statement as the cron job)
select ok(exists (select 1 from cron.job where jobname = 'purge-deleted-tasks'), 'the purge job is scheduled');
insert into public.todo_tasks (id, user_id, title, deleted_at)
  values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Old one', now() - interval '11 days');
delete from public.todo_tasks where deleted_at < now() - interval '10 days';
select is((select count(*) from public.todo_tasks where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0::bigint, 'deleted more than 10 days ago → gone');
select is((select count(*) from public.todo_tasks where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint, 'deleted today → still kept');
select is((select count(*) from public.todo_steps where task_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint, 'its steps are kept with it');

select * from finish();
rollback;

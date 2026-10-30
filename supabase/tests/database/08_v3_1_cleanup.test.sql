-- Version 3.1 clean-up: what v3 no longer uses is gone, repeating tasks still
-- work without "My Day".
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- clean-up: what v3 no longer uses is gone
select hasnt_column('public', 'todo_tasks', 'my_day_on', 'todo_tasks.my_day_on is dropped');
select hasnt_column('public', 'todo_lists', 'emoji', 'todo_lists.emoji is dropped');
select hasnt_table('public', 'habit_data', 'the v1 table habit_data is dropped');

-- repeating tasks after the clean-up (the function was recreated without my_day_on)
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.todo_tasks (id, title, due_date, repeat_rule)
  values ('cccccccc-0000-0000-0000-000000000001', 'Bins', '2026-10-12', '{"freq":"weekly","interval":1}');
select public.complete_repeating_task('cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', '2026-10-19');
select is((select due_date from public.todo_tasks where id = 'cccccccc-0000-0000-0000-000000000002'), '2026-10-19'::date, 'completing a repeating task still creates the next one');

select * from finish();
rollback;

-- Version 3.3: todo_lists.show_in_all (v3.3).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_column('public', 'todo_lists', 'show_in_all', 'todo_lists has show_in_all');
select col_not_null('public', 'todo_lists', 'show_in_all', 'show_in_all is never empty');
select col_default_is('public', 'todo_lists', 'show_in_all', 'true', 'lists are in All by default');

-- A's list: in All unless switched off
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.todo_lists (id, name, color) values ('cccccccc-0000-0000-0000-000000000001', 'Work', 'blue');
select is((select show_in_all from public.todo_lists where id = 'cccccccc-0000-0000-0000-000000000001'), true, 'a new list is in All');
update public.todo_lists set show_in_all = false where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select show_in_all from public.todo_lists where id = 'cccccccc-0000-0000-0000-000000000001'), false, 'the owner can take a list out of All');

-- B can't change A's list (row level security unchanged)
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
update public.todo_lists set show_in_all = true where id = 'cccccccc-0000-0000-0000-000000000001';
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select show_in_all from public.todo_lists where id = 'cccccccc-0000-0000-0000-000000000001'), false, 'another user can’t put it back');
select throws_ok($$ update public.todo_lists set show_in_all = null where id = 'cccccccc-0000-0000-0000-000000000001' $$, '23502', null, 'null is refused');

select * from finish();
rollback;

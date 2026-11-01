-- Habit groups (v3.6): row level security, limits, and what deleting a group does.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.habit_groups'::regclass), 'RLS is on for habit_groups');

-- A makes a group and puts a habit in it
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.habit_groups (id, name, position) values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Sport', 1);
insert into public.habits (id, name, emoji, group_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Run', '🏃', 'aaaaaaaa-0000-0000-0000-0000000000a1');
select is((select count(*) from public.habit_groups), 1::bigint, 'A sees their group');
select throws_ok($$ insert into public.habit_groups (name) values ('') $$, '23514', null, 'an empty name is refused');
select throws_ok($$ insert into public.habit_groups (name) values (repeat('x', 41)) $$, '23514', null, 'more than 40 characters is refused');

-- B can't see A's group, can't change it, and can't put a habit into it
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.habit_groups), 0::bigint, 'B sees no groups of A');
update public.habit_groups set name = 'Hacked';
delete from public.habit_groups;
select throws_ok(
  $$ insert into public.habits (name, emoji, group_id) values ('Sneaky', '🏃', 'aaaaaaaa-0000-0000-0000-0000000000a1') $$,
  '23503', null, 'B cannot put a habit into A''s group'
);
select throws_ok(
  $$ insert into public.habit_groups (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'Sneaky') $$,
  '42501', null, 'B cannot add a group for A'
);

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select name from public.habit_groups), 'Sport', 'B''s update changed nothing');

-- the default group's name is a setting, "Other" unless renamed
insert into public.user_settings (user_id) values ('11111111-1111-1111-1111-111111111111');
select is((select default_habit_group from public.user_settings), 'Other', 'the default group is called Other');

-- deleting a group moves its habits to the default group (and keeps them)
delete from public.habit_groups where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select is((select count(*) from public.habits), 1::bigint, 'the habit is kept');
select is((select group_id from public.habits), null, 'the habit is now in the default group');

select * from finish();
rollback;

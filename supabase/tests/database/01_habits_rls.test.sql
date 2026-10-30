-- Row level security for habits, completions and settings (test plan TS-S1–S4).
-- Run with: npx supabase test db   (needs the local Supabase stack)
begin;
-- In a cloud project the CLI connects with a temporary login role; the tests
-- act as the database owner (locally they already do). pgTAP lives in the
-- schema "extensions" (the CLI installs it for the run if it's missing).
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);

-- Two users, A and B.
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

-- Helper: act as a signed-in user (what the Data API does with the user's token).
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.habits'::regclass, 'public.habit_completions'::regclass, 'public.user_settings'::regclass)),
  'RLS is on for habits, habit_completions, user_settings'
);

-- User A creates a habit, a check-off and settings.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ insert into public.habits (id, name, emoji) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Read', '📚') $$,
  'A can add a habit (user_id filled in automatically)'
);
select lives_ok(
  $$ insert into public.habit_completions (habit_id, day) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-10') $$,
  'A can check off their habit'
);
select lives_ok(
  $$ insert into public.user_settings (time_zone) values ('Europe/Zurich') $$,
  'A can create their settings'
);
select is((select count(*) from public.habits), 1::bigint, 'A sees their one habit');
select is(
  (select user_id from public.habits where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the habit belongs to A'
);

-- User B can't see or touch any of it.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.habits), 0::bigint, 'B sees none of A''s habits');
select is((select count(*) from public.habit_completions), 0::bigint, 'B sees none of A''s check-offs');
select is((select count(*) from public.user_settings), 0::bigint, 'B sees none of A''s settings');

update public.habits set name = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.habits where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.habit_completions where habit_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select throws_ok(
  $$ insert into public.habits (name, emoji, user_id) values ('Fake', '❌', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'B cannot create a habit in A''s name'
);
select throws_ok(
  $$ insert into public.habit_completions (habit_id, day) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-11') $$,
  '23503', null,
  'B cannot check off A''s habit (composite foreign key)'
);
select throws_ok(
  $$ update public.habit_completions set day = '2026-01-01' $$,
  '42501', null,
  'check-offs cannot be edited, only added or removed'
);

-- Back as the database owner: A's data is unchanged.
set local role postgres;
select is(
  (select name from public.habits where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Read',
  'B''s update changed nothing'
);
select is((select count(*) from public.habit_completions where user_id = '11111111-1111-1111-1111-111111111111'), 1::bigint, 'B''s deletes removed nothing');

-- Visitors who are not signed in get nothing at all.
set local role anon;
select throws_ok($$ select * from public.habits $$, '42501', null, 'anon cannot read habits');
select throws_ok($$ select * from public.user_settings $$, '42501', null, 'anon cannot read settings');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot call delete_my_account');
set local role postgres;

-- Input checks.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ insert into public.habits (name, emoji) values ('', '📚') $$,
  '23514', null,
  'an empty habit name is rejected'
);

-- "Delete my account" removes A and everything A owns, and nothing of B.
select lives_ok($$ select public.delete_my_account() $$, 'A can delete their own account');
set local role postgres;
select is(
  (select count(*) from public.habits where user_id = '11111111-1111-1111-1111-111111111111')
    + (select count(*) from public.habit_completions where user_id = '11111111-1111-1111-1111-111111111111')
    + (select count(*) from public.user_settings where user_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'all of A''s rows are gone'
);

select * from finish();
rollback;

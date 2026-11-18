-- Habit breaks (v3.8): the status column, who may change it, and the limit setting.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- A ticks a day: without a status it is a done day
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.habits (id, name, emoji) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Gym', '🏃');
insert into public.habit_completions (habit_id, day) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-17');
select is((select status from public.habit_completions where day = '2026-11-17'), 'done', 'a day without a status is done');

-- second tap: done → break
update public.habit_completions set status = 'break' where habit_id = 'aaaaaaaa-0000-0000-0000-000000000001' and day = '2026-11-17';
select is((select status from public.habit_completions where day = '2026-11-17'), 'break', 'A can turn a done day into a break');
select throws_ok(
  $$ update public.habit_completions set status = 'skipped' where day = '2026-11-17' $$,
  '23514', null, 'only done and break are allowed'
);
select throws_ok(
  $$ update public.habit_completions set day = '2026-11-16' where day = '2026-11-17' $$,
  '42501', null, 'the day itself cannot be changed'
);

-- B cannot touch A's break
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
update public.habit_completions set status = 'done';
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select status from public.habit_completions where day = '2026-11-17'), 'break', 'B cannot change A''s break');

-- the limit: empty (no limit) to start with, 1–31 allowed
insert into public.user_settings (user_id) values ('11111111-1111-1111-1111-111111111111');
select is((select habit_break_limit from public.user_settings), null, 'no break limit to start with');
update public.user_settings set habit_break_limit = 4;
select is((select habit_break_limit from public.user_settings), 4::smallint, 'a limit can be set');
select throws_ok($$ update public.user_settings set habit_break_limit = 0 $$, '23514', null, 'a limit of 0 is refused');

select * from finish();
rollback;

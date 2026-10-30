-- Shopping list (v3): row level security and limits (test plan v3 TS-K5, TS-K6).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.shopping_items'::regclass), 'RLS is on for shopping_items');

-- A adds two items and ticks one
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.shopping_items (id, title, position) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Oat milk', 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Dog food', 2);
update public.shopping_items set ticked_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is((select count(*) from public.shopping_items), 2::bigint, 'A sees their two items');
select is((select count(*) from public.shopping_items where ticked_at is not null), 1::bigint, 'A ticked one');

select throws_ok($$ insert into public.shopping_items (title) values ('') $$, '23514', null, 'an empty item is refused');
select throws_ok($$ insert into public.shopping_items (title) values (repeat('x', 201)) $$, '23514', null, 'more than 200 characters is refused');

-- B sees, changes and deletes nothing of A, and can't add rows for A
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.shopping_items), 0::bigint, 'B sees no items of A');
update public.shopping_items set title = 'Hacked';
delete from public.shopping_items;
select throws_ok(
  $$ insert into public.shopping_items (user_id, title) values ('11111111-1111-1111-1111-111111111111', 'Sneaky') $$,
  '42501', null, 'B cannot add an item for A'
);

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select title from public.shopping_items where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Oat milk', 'B''s update changed nothing');
select is((select count(*) from public.shopping_items), 2::bigint, 'B''s delete removed nothing');

select * from finish();
rollback;

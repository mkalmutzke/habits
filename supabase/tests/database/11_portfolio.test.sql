-- Version 3.4: the IBKR portfolio tables – the owner may only read them, only
-- the server function writes them.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into private.allowed_emails (email) values ('owner@test.local');
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'other@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.portfolio_snapshots'::regclass), 'RLS is on for portfolio_snapshots');
select ok((select relrowsecurity from pg_class where oid = 'public.portfolio_positions'::regclass), 'RLS is on for portfolio_positions');

-- an older day first: its positions go once a newer day is more than 7 days later
select lives_ok(
  $$ select public.store_portfolio_snapshot(
       '{"as_of": "2026-10-01", "base_currency": "CHF", "nav": 900}',
       '[{"symbol": "OLD", "quantity": 1, "value_base": 900}]'
     ) $$,
  'an older day is stored'
);

-- the server stores a snapshot with two positions for the one owner
select isnt(
  public.store_portfolio_snapshot(
    '{"as_of": "2026-10-27", "base_currency": "CHF", "nav": 1000, "cash": 100, "day_change": 8, "day_twr": 0.8, "twr": 9.6, "twr_from": "2026-01-01", "twr_to": "2026-10-27"}',
    '[{"symbol": "AAA", "quantity": 10, "value_base": 600}, {"symbol": "BBB", "quantity": 5, "value_base": 300}]'
  ),
  null::uuid,
  'the server stores a snapshot'
);
select is((select user_id from public.portfolio_snapshots where as_of = '2026-10-27'), '11111111-1111-1111-1111-111111111111'::uuid, 'it belongs to the allowlisted owner');
select is((select count(*) from public.portfolio_positions), 2::bigint, 'with its two positions; the old day''s position is gone');
select is((select count(*) from public.portfolio_snapshots), 2::bigint, 'the old day''s snapshot itself stays');

-- the same day again replaces it, positions included
select lives_ok(
  $$ select public.store_portfolio_snapshot(
       '{"as_of": "2026-10-27", "base_currency": "CHF", "nav": 1010}',
       '[{"symbol": "AAA", "quantity": 10, "value_base": 610}]'
     ) $$,
  'the same day can be stored again'
);
select is((select count(*) from public.portfolio_snapshots where as_of = '2026-10-27'), 1::bigint, 'one snapshot per day');
select is((select nav from public.portfolio_snapshots where as_of = '2026-10-27'), 1010::numeric, 'with the newer figures');
select is((select count(*) from public.portfolio_positions), 1::bigint, 'and only the newer positions');

-- the owner reads, but cannot write
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select count(*) from public.portfolio_positions), 1::bigint, 'the owner sees their positions');
select throws_ok(
  $$ insert into public.portfolio_snapshots (user_id, as_of, base_currency, nav) values ('11111111-1111-1111-1111-111111111111', '2026-10-28', 'CHF', 1) $$,
  '42501', null, 'the owner cannot add a snapshot'
);
select throws_ok(
  $$ select public.store_portfolio_snapshot('{}', '[]') $$,
  '42501', null, 'a signed-in user cannot call the server function'
);

-- someone else sees nothing
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.portfolio_snapshots), 0::bigint, 'another account sees no snapshots');
select is((select count(*) from public.portfolio_positions), 0::bigint, 'and no positions');

-- the server function may read snapshots (retry check) but never write them directly
select ok(has_table_privilege('service_role', 'public.portfolio_snapshots', 'select'), 'the server role can read snapshots');
select ok(not has_table_privilege('service_role', 'public.portfolio_snapshots', 'insert'), 'but cannot insert them directly');

select * from finish();
rollback;

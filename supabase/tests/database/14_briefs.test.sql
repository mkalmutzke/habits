-- Version 3.6: the daily briefs – only the server writes them, the owner may
-- read them and mark them as seen, nothing else.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

insert into private.allowed_emails (email) values ('owner@test.local');
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'other@test.local', 'authenticated', 'authenticated');
insert into public.user_settings (user_id, time_zone) values ('11111111-1111-1111-1111-111111111111', 'Europe/Zurich');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.briefs'::regclass), 'RLS is on for briefs');

-- the context for a scheduled task: day, switches, holdings without figures
select is((public.brief_context() -> 'on' ->> 'jobs')::boolean, true, 'a brief is on to start with');
select is(public.brief_context() ->> 'today', (now() at time zone 'Europe/Zurich')::date::text, 'today is the owner''s day');
insert into public.portfolio_snapshots (id, user_id, as_of, base_currency, nav)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-10-30', 'CHF', 1000);
insert into public.portfolio_positions (user_id, snapshot_id, symbol, description, asset_class, quantity, value_base)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'VWO', 'EM ETF', 'STK', 5, 200),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'VT', 'World ETF', 'STK', 10, 800);
select is(public.brief_context() -> 'holdings', '[{"symbol": "VT", "description": "World ETF", "asset_class": "STK"}, {"symbol": "VWO", "description": "EM ETF", "asset_class": "STK"}]'::jsonb, 'holdings: symbol, name and type only, largest first');
select ok(public.brief_context()::text !~ '800|quantity|value', 'no quantities or values in the context');

-- the server stores a brief; a second one replaces it and clears "seen"
select is(public.store_brief('world', '{"sections": [{"heading": "A", "items": []}]}'), (now() at time zone 'Europe/Zurich')::date, 'stored for the owner''s today');
update public.briefs set seen_on = current_date;
select lives_ok($$ select public.store_brief('world', '{"summary": "newer", "sections": []}') $$, 'a newer brief replaces it');
select is((select count(*) from public.briefs where kind = 'world'), 1::bigint, 'only the latest brief is kept');
select is((select content ->> 'summary' from public.briefs where kind = 'world'), 'newer', 'the newer content is kept');
select is((select seen_on from public.briefs where kind = 'world'), null, 'and it is unseen again');
select throws_ok($$ select public.store_brief('sports', '{}') $$, '23514', null, 'an unknown kind is refused');

-- the owner reads it and marks it as seen – but can't change the content
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select count(*) from public.briefs), 1::bigint, 'the owner sees their brief');
update public.briefs set seen_on = '2026-11-01';
select is((select seen_on from public.briefs), '2026-11-01'::date, 'the owner can mark it as seen');
select throws_ok($$ update public.briefs set content = '{"hacked": true}' $$, '42501', null, 'the owner cannot change the content');
select throws_ok($$ select public.store_brief('jobs', '{}') $$, '42501', null, 'the app cannot store a brief');

-- another account sees nothing
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.briefs), 0::bigint, 'another account sees no briefs');

select * from finish();
rollback;

-- Server health (v3.8): adding servers, the agent token, storing reports, isolation.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table added (id uuid, token text);
grant all on added to authenticated, service_role;

select ok((select relrowsecurity from pg_class where oid = 'public.servers'::regclass), 'RLS is on for servers');
select ok((select relrowsecurity from pg_class where oid = 'public.server_reports'::regclass), 'RLS is on for server_reports');

-- A adds a server and gets its token once
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into added select (r ->> 'id')::uuid, r ->> 'token' from (select public.add_server('vps-zrh-1', 'netcup') as r) x;
select is((select count(*) from public.servers), 1::bigint, 'A sees their new server');
select ok((select token ~ '^[0-9a-f]{64}$' from added), 'the token is 64 random hex characters');
select throws_ok($$ select * from private.server_tokens $$, '42501', null, 'the app cannot read token fingerprints');
select throws_ok($$ insert into public.servers (name) values ('direct') $$, '42501', null, 'servers are only added through add_server');
select throws_ok($$ select public.store_server_report('x', '{}'::jsonb) $$, '42501', null, 'the app cannot store reports');

-- the server (as server-ingest) stores a report with the token
set local role service_role;
select is(public.store_server_report((select token from added), '{"cpu": 12.5, "disk_used_gb": 130, "disk_total_gb": 160, "services": [{"name": "nginx", "active": true}]}'::jsonb), 'stored', 'a report with the right token is stored');
select is(public.store_server_report((select token from added), '{"cpu": 13}'::jsonb), 'too soon', 'a second report within 50 seconds is refused');
select is(public.store_server_report(repeat('0', 64), '{"cpu": 13}'::jsonb), 'unknown', 'an unknown token stores nothing');
set local role postgres;
select is((select token_hash from private.server_tokens), encode(extensions.digest((select token from added), 'sha256'), 'hex'), 'only the fingerprint is kept');

-- A sees the report; B sees nothing and can't change A's server
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select cpu from public.server_reports), 12.5::numeric, 'A sees the report');
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.servers) + (select count(*) from public.server_reports), 0::bigint, 'B sees none of A''s servers or reports');
update public.servers set name = 'hacked';
select throws_ok($$ select public.renew_server_token((select id from added)) $$, '42501', null, 'B cannot renew A''s token');

-- a new token: the old one stops working
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select isnt(public.renew_server_token((select id from added)), (select token from added), 'A gets a new token');
set local role postgres;
update public.servers set last_report_at = null;
set local role service_role;
select is(public.store_server_report((select token from added), '{"cpu": 1}'::jsonb), 'unknown', 'the old token no longer works');

select * from finish();
rollback;

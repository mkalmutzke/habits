-- Brief settings (v3.9): stored per user, handed to the morning run, size-limited.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into private.allowed_emails (email) values ('owner@test.local');
insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'owner@test.local', 'authenticated', 'authenticated');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
insert into public.user_settings (user_id) values ('11111111-1111-1111-1111-111111111111');
select is((select brief_prefs from public.user_settings), '{}'::jsonb, 'no settings to start with: the briefs work as before');
update public.user_settings set brief_prefs = '{"jobs": {"countries": ["Canada", "Switzerland"], "icon": false}}';
select is((select brief_prefs -> 'jobs' -> 'countries' ->> 1 from public.user_settings), 'Switzerland', 'the owner can save brief settings');
select throws_ok($$ update public.user_settings set brief_prefs = '[]' $$, '23514', null, 'the settings must be an object');
select throws_ok($$ update public.user_settings set brief_prefs = jsonb_build_object('jobs', jsonb_build_object('about', repeat('x', 20000))) $$, '23514', null, 'oversized settings are refused');

set local role postgres;
select is(public.brief_context() -> 'prefs' -> 'jobs' -> 'countries', '["Canada", "Switzerland"]'::jsonb, 'the morning run gets the settings');

select * from finish();
rollback;

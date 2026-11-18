-- Calendars (v3.9): adding, the private address, storing events, isolation.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table cal (id uuid);
grant all on cal to authenticated, service_role;

select ok((select relrowsecurity from pg_class where oid = 'public.calendar_events'::regclass), 'RLS is on for calendar_events');

-- A adds a calendar; the address can't be read back, not even by A
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into cal select public.add_calendar('Work', 'sky', 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics');
select is((select name || ' ' || color from public.calendar_sources), 'Work sky', 'A sees the new calendar');
select throws_ok($$ select * from private.calendar_addresses $$, '42501', null, 'the address is not readable from the app');
select throws_ok($$ select public.add_calendar('Bad', 'teal', 'http://example.com/a.ics') $$, '23514', null, 'only https addresses');
select throws_ok($$ select public.add_calendar('Bad', 'pink', 'https://example.com/a.ics') $$, '23514', null, 'only the known colours');
select throws_ok($$ insert into public.calendar_sources (name) values ('direct') $$, '42501', null, 'calendars are only added through add_calendar');
select throws_ok($$ select public.store_calendar_events((select id from cal), '[]'::jsonb) $$, '42501', null, 'the app cannot store events');
update public.calendar_sources set name = 'Work calendar', enabled = false;
select is((select name from public.calendar_sources), 'Work calendar', 'A can rename and switch off a calendar');
update public.calendar_sources set enabled = true;

-- the server reads the jobs and stores events
set local role service_role;
select is((select address from public.calendar_jobs('11111111-1111-1111-1111-111111111111') where source_id = (select id from cal)), 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics', 'calendar-sync gets the address');
select is(public.store_calendar_events((select id from cal), '[{"uid": "a", "all_day": false, "starts_at": "2026-11-18T08:30:00Z", "ends_at": "2026-11-18T09:00:00Z", "title": "Stand-up"}, {"uid": "b", "all_day": true, "start_day": "2026-11-18", "end_day": "2026-11-19", "title": "Birthday"}]'::jsonb), 2, 'two events stored');
select is(public.store_calendar_events((select id from cal), null, 'HTTP 404'), 0, 'a failed read only notes the reason');
set local role postgres;
select is((select count(*) from public.calendar_events where source_id = (select id from cal)), 2::bigint, 'the events from before are kept after a failed read');
select is((select last_error from public.calendar_sources where id = (select id from cal)), 'HTTP 404', 'the reason is shown');

-- B sees nothing of A's and can't change the address
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select is((select count(*) from public.calendar_sources) + (select count(*) from public.calendar_events), 0::bigint, 'B sees none of A''s calendars or events');
select throws_ok($$ select public.change_calendar_address((select id from cal), 'https://evil.example/a.ics') $$, '42501', null, 'B cannot change A''s address');

select * from finish();
rollback;

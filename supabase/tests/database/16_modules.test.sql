-- Modules (v3.8): show or hide IBKR and Garmin – defaults and allowed values.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'a@test.local', 'authenticated', 'authenticated');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

insert into public.user_settings (user_id) values ('11111111-1111-1111-1111-111111111111');
select is((select ibkr_display from public.user_settings), 'section', 'IBKR shows as a card to start with');
select is((select garmin_display from public.user_settings), 'icon', 'Garmin shows as an icon to start with');
update public.user_settings set garmin_display = 'section', ibkr_display = 'off';
select is((select garmin_display || ' ' || ibkr_display from public.user_settings), 'section off', 'the user can change both');
select throws_ok($$ update public.user_settings set garmin_display = 'popup' $$, '23514', null, 'unknown Garmin choices are refused');
select throws_ok($$ update public.user_settings set ibkr_display = 'icon' $$, '23514', null, 'IBKR has no icon form');

select * from finish();
rollback;

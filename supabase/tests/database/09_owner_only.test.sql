-- Version 3.2: owner only – allowlist, "before user created" hook, the
-- allowlist following a confirmed email change.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

-- an allowed account (the migration seeds the allowlist from existing accounts;
-- here we add the test address ourselves)
create function pg_temp.act_as(uid uuid, signed_in_by text, seconds_ago integer) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object(
           'sub', uid, 'role', 'authenticated',
           'amr', json_build_array(json_build_object('method', signed_in_by, 'timestamp', extract(epoch from now())::bigint - seconds_ago))
         )::text, true);
$$;
insert into private.allowed_emails (email) values ('owner@test.local');
insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'owner@test.local', 'authenticated', 'authenticated');

select is(
  public.hook_before_user_created('{"user": {"email": "owner@test.local"}}'::jsonb),
  '{}'::jsonb,
  'an allowlisted address may get an account'
);
select is(
  public.hook_before_user_created('{"user": {"email": "Owner@Test.Local"}}'::jsonb),
  '{}'::jsonb,
  'upper/lower case does not matter'
);
select is(
  public.hook_before_user_created('{"user": {"email": "someone.else@test.local"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'any other address is refused (403)'
);
select is(
  public.hook_before_user_created('{"user": {}}'::jsonb) -> 'error' ->> 'message',
  'This app is private.',
  'no address at all is refused too'
);

-- only Supabase Auth may call the hook
select throws_ok(
  $$ select set_config('role', 'authenticated', true); select public.hook_before_user_created('{}'::jsonb) $$,
  '42501', null, 'signed-in users cannot call the hook'
);
select set_config('role', 'postgres', true);
select throws_ok(
  $$ select set_config('role', 'anon', true); select count(*) from private.allowed_emails $$,
  '42501', null, 'the allowlist is not readable through the API'
);
select set_config('role', 'postgres', true);

-- the address can't change to one that isn't allowed (any way, also admin)
select throws_ok(
  $$ update auth.users set email = 'thief@test.local' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'changing to an address that is not allowed is refused'
);

-- allowing a new address needs a session signed in by a code within 10 minutes
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', 'password', 5);
select throws_ok($$ select public.allow_email_change('new.owner@test.local') $$, '42501', null, 'a session signed in another way may not allow a new address');
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', 'otp', 3600);
select throws_ok($$ select public.allow_email_change('new.owner@test.local') $$, '42501', null, 'an old code session (1 h) may not either');
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', 'otp', 60);
select lives_ok($$ select public.allow_email_change('New.Owner@test.local') $$, 'a fresh code session may allow the new address');
select set_config('role', 'postgres', true);
select is(
  public.hook_before_user_created('{"user": {"email": "new.owner@test.local"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'a planned new address is not a sign-up ticket'
);

-- the confirmed email change moves the allowlist entry
update auth.users set email = 'new.owner@test.local' where id = '11111111-1111-1111-1111-111111111111';
select ok(exists (select 1 from private.allowed_emails where email = 'new.owner@test.local' and pending_until is null), 'the new address is now the account address');
select ok(not exists (select 1 from private.allowed_emails where email = 'owner@test.local'), 'the old address is not allowed any more');
select is(
  public.hook_before_user_created('{"user": {"email": "owner@test.local"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'a new account with the old address is refused'
);

select * from finish();
rollback;

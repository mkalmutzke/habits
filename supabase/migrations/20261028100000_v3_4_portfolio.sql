-- Version 3.4: the IBKR card on What's up? (read-only
-- reports). One snapshot per trading day from IBKR's Flex Web Service, written
-- only by the Edge Function ibkr-sync; the app may only read it.
-- Additive only (rollback-safe): the live 3.3 app neither reads nor writes these.

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- the trading day the figures are from
  as_of date not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  -- net value (positions + cash) and cash, in the base currency
  nav numeric not null,
  cash numeric,
  -- the move on that day: amount and IBKR's time-weighted return in percent
  day_change numeric,
  day_twr numeric,
  -- IBKR's time-weighted return in percent for twr_from … twr_to (year to date)
  twr numeric,
  twr_from date,
  twr_to date,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, as_of)
);
comment on table public.portfolio_snapshots is 'v3.4: one IBKR portfolio snapshot per trading day (server-written, 400 days).';

create table public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_id uuid not null references public.portfolio_snapshots (id) on delete cascade,
  symbol text not null,
  description text,
  asset_class text,
  -- the position's own currency (prices are in it); every *_base amount is in the base currency
  currency text,
  quantity numeric not null,
  mark_price numeric,
  prev_close_price numeric,
  value_base numeric not null,
  day_change_base numeric,
  cost_basis_base numeric,
  unrealized_base numeric,
  created_at timestamptz not null default now()
);
comment on table public.portfolio_positions is 'v3.4: the holdings of one portfolio snapshot (server-written).';
create index portfolio_positions_snapshot_idx on public.portfolio_positions (snapshot_id);
create index portfolio_positions_user_id_idx on public.portfolio_positions (user_id);

create trigger portfolio_snapshots_broadcast after insert or update or delete on public.portfolio_snapshots
  for each row execute function private.broadcast_change();
create trigger portfolio_positions_broadcast after insert or update or delete on public.portfolio_positions
  for each row execute function private.broadcast_change();

-- Users may only read their own rows; nobody but the function below writes.
alter table public.portfolio_snapshots enable row level security;
alter table public.portfolio_positions enable row level security;
create policy "Read own portfolio snapshots" on public.portfolio_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Read own portfolio positions" on public.portfolio_positions for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.portfolio_snapshots, public.portfolio_positions from public, anon, authenticated, service_role;
grant select on table public.portfolio_snapshots, public.portfolio_positions to authenticated;

-- ---------------------------------------------------------------------------
-- Stores one snapshot for the owner (the app is owner-only, v3.2: the single
-- account on the allowlist). A snapshot of the same day replaces the earlier
-- one, positions included – all in one transaction. Positions are kept only for
-- the last 7 days (the app loads the whole table and shows the newest day);
-- the snapshots themselves stay 400 days. Only the server may call it.
--   snapshot:  { as_of, base_currency, nav, cash, day_change, day_twr, twr, twr_from, twr_to }
--   positions: [{ symbol, description, asset_class, currency, quantity, mark_price,
--                 prev_close_price, value_base, day_change_base, cost_basis_base, unrealized_base }]
create or replace function public.store_portfolio_snapshot(snapshot jsonb, positions jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owners uuid[];
  new_id uuid;
begin
  select array_agg(u.id) into owners
    from auth.users u
    join private.allowed_emails a on a.email = lower(u.email)
   where a.pending_until is null;
  if coalesce(array_length(owners, 1), 0) <> 1 then
    raise exception 'store_portfolio_snapshot: expected exactly one owner account, found %', coalesce(array_length(owners, 1), 0);
  end if;

  insert into public.portfolio_snapshots as s
    (user_id, as_of, base_currency, nav, cash, day_change, day_twr, twr, twr_from, twr_to, fetched_at)
  values (
    owners[1],
    (snapshot ->> 'as_of')::date,
    snapshot ->> 'base_currency',
    (snapshot ->> 'nav')::numeric,
    (snapshot ->> 'cash')::numeric,
    (snapshot ->> 'day_change')::numeric,
    (snapshot ->> 'day_twr')::numeric,
    (snapshot ->> 'twr')::numeric,
    (snapshot ->> 'twr_from')::date,
    (snapshot ->> 'twr_to')::date,
    now()
  )
  on conflict (user_id, as_of) do update set
    base_currency = excluded.base_currency,
    nav = excluded.nav,
    cash = excluded.cash,
    day_change = excluded.day_change,
    day_twr = excluded.day_twr,
    twr = excluded.twr,
    twr_from = excluded.twr_from,
    twr_to = excluded.twr_to,
    fetched_at = excluded.fetched_at
  returning s.id into new_id;

  delete from public.portfolio_positions p where p.snapshot_id = new_id;
  insert into public.portfolio_positions
    (user_id, snapshot_id, symbol, description, asset_class, currency, quantity, mark_price,
     prev_close_price, value_base, day_change_base, cost_basis_base, unrealized_base)
  select owners[1], new_id,
         p ->> 'symbol', p ->> 'description', p ->> 'asset_class', p ->> 'currency',
         (p ->> 'quantity')::numeric, (p ->> 'mark_price')::numeric, (p ->> 'prev_close_price')::numeric,
         (p ->> 'value_base')::numeric, (p ->> 'day_change_base')::numeric,
         (p ->> 'cost_basis_base')::numeric, (p ->> 'unrealized_base')::numeric
    from jsonb_array_elements(coalesce(positions, '[]'::jsonb)) p;

  delete from public.portfolio_positions p
   using public.portfolio_snapshots s
   where p.snapshot_id = s.id
     and s.user_id = owners[1]
     and s.as_of < (snapshot ->> 'as_of')::date - 7;

  return new_id;
end;
$$;
revoke all on function public.store_portfolio_snapshot(jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.store_portfolio_snapshot(jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Scheduler: IBKR builds the daily statement overnight. Tuesday to Saturday at
-- 05:30 and 07:30 UTC (06:30 / 08:30 in Zurich in winter, one hour later in
-- summer). The second run is a retry; the function skips the day if a snapshot
-- was already fetched. Same project address and scheduler token as
-- send-reminders. `select cron.unschedule('ibkr-sync');` (and '-retry') stops it.
select cron.schedule(
  'ibkr-sync',
  '30 5 * * 2-6',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ibkr-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $job$
);
select cron.schedule(
  'ibkr-sync-retry',
  '30 7 * * 2-6',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ibkr-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $job$
);

-- Housekeeping once a day: snapshots older than 400 days (their positions go with them).
select cron.schedule(
  'cleanup-portfolio',
  '27 3 * * *',
  $job$
  delete from public.portfolio_snapshots where as_of < current_date - 400;
  $job$
);

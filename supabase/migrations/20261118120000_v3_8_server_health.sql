-- Version 3.8, step 19: server health (owner, 18 Nov 2026). A small agent on
-- the user's own server (scripts/server-agent, any hosting provider: netcup,
-- Hetzner, …) sends its figures every 5 minutes to the Edge Function
-- server-ingest, which stores them here with store_server_report(). The app
-- shows them behind a header icon (Settings → Modules → Server health).
-- Each server proves itself with its own random token. The database keeps
-- only the token's SHA-256 fingerprint, in a private table the app can't
-- read; the token itself is shown once, when the server is added.
-- Per user from the start: every user sees only their own servers.
-- Additive only (rollback-safe).

create table public.servers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  provider text not null default 'other' check (provider in ('netcup', 'hetzner', 'other')),
  -- warning limits in percent (Settings → Servers)
  cpu_warn smallint not null default 90 check (cpu_warn between 50 and 100),
  memory_warn smallint not null default 90 check (memory_warn between 50 and 100),
  disk_warn smallint not null default 80 check (disk_warn between 50 and 99),
  last_report_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.servers is 'v3.8: the user''s servers whose health agent reports to server-ingest.';
create index servers_user_id_idx on public.servers (user_id);

create table private.server_tokens (
  server_id uuid primary key references public.servers (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
comment on table private.server_tokens is 'v3.8: SHA-256 fingerprint of each server''s agent token (never the token itself).';

create table public.server_reports (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reported_at timestamptz not null default now(),
  cpu numeric check (cpu between 0 and 100),
  load1 numeric check (load1 >= 0),
  load5 numeric check (load5 >= 0),
  load15 numeric check (load15 >= 0),
  memory_used_mb integer check (memory_used_mb >= 0),
  memory_total_mb integer check (memory_total_mb >= 0),
  disk_used_gb numeric check (disk_used_gb >= 0),
  disk_total_gb numeric check (disk_total_gb >= 0),
  uptime_s bigint check (uptime_s >= 0),
  -- [{ name, active }] – the systemd services the agent was told to watch
  services jsonb not null default '[]' check (jsonb_typeof(services) = 'array' and pg_column_size(services) <= 4096),
  containers_running integer check (containers_running >= 0),
  containers_total integer check (containers_total >= 0),
  updates_pending integer check (updates_pending >= 0),
  reboot_required boolean,
  -- days until the watched TLS certificate expires (empty = not watched)
  cert_days integer
);
comment on table public.server_reports is 'v3.8: health reports of the servers, every 5 minutes, kept 2 days (server-written).';
create index server_reports_server_time_idx on public.server_reports (server_id, reported_at);
create index server_reports_user_id_idx on public.server_reports (user_id);

create trigger servers_broadcast after insert or update or delete on public.servers
  for each row execute function private.broadcast_change();
create trigger server_reports_broadcast after insert or update or delete on public.server_reports
  for each row execute function private.broadcast_change();

alter table public.servers enable row level security;
alter table public.server_reports enable row level security;
create policy "Own servers" on public.servers for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Read own server reports" on public.server_reports for select to authenticated
  using ((select auth.uid()) = user_id);

-- The app reads its servers, renames them and changes the limits, and deletes
-- them. New servers only through add_server() (which makes the token);
-- reports only through store_server_report() (server-ingest).
revoke all on table public.servers, public.server_reports from public, anon, authenticated, service_role;
revoke all on table private.server_tokens from public, anon, authenticated, service_role;
grant select, delete on table public.servers to authenticated;
grant update (name, provider, cpu_warn, memory_warn, disk_warn) on table public.servers to authenticated;
grant select on table public.server_reports to authenticated;

-- A new random agent token for a server, stored as its fingerprint; returns the token.
create or replace function private.new_server_token(server uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into private.server_tokens as t (server_id, token_hash)
  values (server, encode(extensions.digest(token, 'sha256'), 'hex'))
  on conflict (server_id) do update set token_hash = excluded.token_hash, created_at = now();
  return token;
end;
$$;
revoke all on function private.new_server_token(uuid) from public, anon, authenticated, service_role;

-- Settings → Servers → Add: the new server and its token (shown once, for
-- the install command). At most 5 servers per user.
create or replace function public.add_server(server_name text, server_provider text default 'other')
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'add_server: not signed in' using errcode = '42501';
  end if;
  if (select count(*) from public.servers s where s.user_id = me) >= 5 then
    raise exception 'add_server: at most 5 servers' using errcode = '23514';
  end if;
  insert into public.servers (user_id, name, provider)
  values (me, btrim(server_name), coalesce(server_provider, 'other'))
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'token', private.new_server_token(new_id));
end;
$$;
revoke all on function public.add_server(text, text) from public, anon, authenticated, service_role;
grant execute on function public.add_server(text, text) to authenticated;

-- Settings → Servers → New token: the old one stops working at once.
create or replace function public.renew_server_token(server uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.servers s where s.id = server and s.user_id = auth.uid()) then
    raise exception 'renew_server_token: not your server' using errcode = '42501';
  end if;
  return private.new_server_token(server);
end;
$$;
revoke all on function public.renew_server_token(uuid) from public, anon, authenticated, service_role;
grant execute on function public.renew_server_token(uuid) to authenticated;

-- Stores one report for the server whose token it is (server-ingest checks
-- and trims the report first, _shared/serverReport.js). At most one report
-- per 50 seconds and server. Answers 'stored', 'unknown' (no such token) or
-- 'too soon'. Only the server (server-ingest) may call it.
create or replace function public.store_server_report(token text, report jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select s.id, s.user_id, s.last_report_at into target
    from private.server_tokens t
    join public.servers s on s.id = t.server_id
   where t.token_hash = encode(extensions.digest(coalesce(token, ''), 'sha256'), 'hex');
  if target.id is null then
    return 'unknown';
  end if;
  if target.last_report_at > now() - interval '50 seconds' then
    return 'too soon';
  end if;
  insert into public.server_reports (
    server_id, user_id, cpu, load1, load5, load15, memory_used_mb, memory_total_mb,
    disk_used_gb, disk_total_gb, uptime_s, services, containers_running, containers_total,
    updates_pending, reboot_required, cert_days
  ) values (
    target.id, target.user_id,
    (report ->> 'cpu')::numeric, (report ->> 'load1')::numeric, (report ->> 'load5')::numeric, (report ->> 'load15')::numeric,
    (report ->> 'memory_used_mb')::integer, (report ->> 'memory_total_mb')::integer,
    (report ->> 'disk_used_gb')::numeric, (report ->> 'disk_total_gb')::numeric,
    (report ->> 'uptime_s')::bigint, coalesce(report -> 'services', '[]'::jsonb),
    (report ->> 'containers_running')::integer, (report ->> 'containers_total')::integer,
    (report ->> 'updates_pending')::integer, (report ->> 'reboot_required')::boolean,
    (report ->> 'cert_days')::integer
  );
  update public.servers set last_report_at = now() where id = target.id;
  return 'stored';
end;
$$;
revoke all on function public.store_server_report(text, jsonb) from public, anon, authenticated;
grant execute on function public.store_server_report(text, jsonb) to service_role;

-- Reports older than 2 days are removed every hour (the window shows 24 hours).
-- `select cron.unschedule('purge-server-reports');` stops it.
select cron.schedule(
  'purge-server-reports',
  '23 * * * *',
  $$delete from public.server_reports where reported_at < now() - interval '2 days'$$
);

-- Settings → Modules → Server health: the header icon on or off (off to start with).
alter table public.user_settings
  add column server_display text not null default 'off' check (server_display in ('off', 'icon'));
comment on column public.user_settings.server_display is 'v3.8: server health icon in the header (icon) or hidden (off).';

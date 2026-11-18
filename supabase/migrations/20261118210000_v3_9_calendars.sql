-- Version 3.9, step 28: calendars on the Dawn page (owner, 18 Nov 2026).
-- Each user adds calendars by their secret iCal address (Google, iCloud,
-- Outlook…). The Edge Function calendar-sync reads them every 15 minutes
-- (and on Refresh), keeps the events from yesterday to two weeks ahead in
-- calendar_events, and the app shows today and the next 6 days.
-- The address works like a password (anyone with it can read the calendar),
-- so it is kept in a private table the app cannot read back; the app only
-- writes it through add_calendar() / change_calendar_address().
-- Additive only (rollback-safe).

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'teal' check (color in ('teal', 'amber', 'green', 'violet', 'coral', 'gold', 'sky', 'rose')),
  enabled boolean not null default true,
  last_sync_at timestamptz,
  -- a short reason when the last read failed (the events from before stay)
  last_error text check (char_length(last_error) <= 200),
  event_count integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.calendar_sources is 'v3.9: the user''s calendars (iCal), read by calendar-sync.';
create index calendar_sources_user_id_idx on public.calendar_sources (user_id);

create table private.calendar_addresses (
  source_id uuid primary key references public.calendar_sources (id) on delete cascade,
  address text not null check (address ~ '^https://' and char_length(address) <= 2000)
);
comment on table private.calendar_addresses is 'v3.9: the secret iCal address of each calendar (never readable by the app).';

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.calendar_sources (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  uid text not null default '' check (char_length(uid) <= 500),
  all_day boolean not null,
  starts_at timestamptz,
  ends_at timestamptz,
  start_day date,
  end_day date,
  title text not null check (char_length(title) <= 300),
  location text not null default '' check (char_length(location) <= 300),
  link text not null default '' check (char_length(link) <= 1000),
  check ((all_day and start_day is not null and end_day is not null) or (not all_day and starts_at is not null and ends_at is not null))
);
comment on table public.calendar_events is 'v3.9: events of the user''s calendars, yesterday to two weeks ahead (server-written by calendar-sync).';
create index calendar_events_source_idx on public.calendar_events (source_id);
create index calendar_events_user_id_idx on public.calendar_events (user_id);

create trigger calendar_sources_broadcast after insert or update or delete on public.calendar_sources
  for each row execute function private.broadcast_change();
-- No live message per event (a sync replaces up to 500 rows): every sync
-- updates the calendar's last_sync_at, that change reaches the app live, and
-- the app then loads calendar_events again.

alter table public.calendar_sources enable row level security;
alter table public.calendar_events enable row level security;
create policy "Own calendars" on public.calendar_sources for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Read own calendar events" on public.calendar_events for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.calendar_sources, public.calendar_events from public, anon, authenticated, service_role;
revoke all on table private.calendar_addresses from public, anon, authenticated, service_role;
grant select, delete on table public.calendar_sources to authenticated;
grant update (name, color, enabled) on table public.calendar_sources to authenticated;
grant select on table public.calendar_events to authenticated;

-- Settings → Calendars → Add. At most 10 calendars per user. Returns the id.
create or replace function public.add_calendar(cal_name text, cal_color text, cal_address text)
returns uuid
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
    raise exception 'add_calendar: not signed in' using errcode = '42501';
  end if;
  if (select count(*) from public.calendar_sources s where s.user_id = me) >= 10 then
    raise exception 'add_calendar: at most 10 calendars' using errcode = '23514';
  end if;
  insert into public.calendar_sources (user_id, name, color) values (me, btrim(cal_name), coalesce(cal_color, 'teal'))
  returning id into new_id;
  insert into private.calendar_addresses (source_id, address) values (new_id, btrim(cal_address));
  return new_id;
end;
$$;
revoke all on function public.add_calendar(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.add_calendar(text, text, text) to authenticated;

-- Settings → Calendars → Change address (e.g. after resetting it at Google).
create or replace function public.change_calendar_address(source uuid, cal_address text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.calendar_sources s where s.id = source and s.user_id = auth.uid()) then
    raise exception 'change_calendar_address: not your calendar' using errcode = '42501';
  end if;
  update private.calendar_addresses set address = btrim(cal_address) where source_id = source;
  update public.calendar_sources set last_error = null where id = source;
end;
$$;
revoke all on function public.change_calendar_address(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.change_calendar_address(uuid, text) to authenticated;

-- What calendar-sync reads: the switched-on calendars (of one user, or of
-- everyone for the scheduler) with their address and the user's time zone.
create or replace function public.calendar_jobs(only_user uuid default null)
returns table (source_id uuid, user_id uuid, address text, time_zone text, last_sync_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, a.address, coalesce(u.time_zone, 'UTC'), s.last_sync_at
    from public.calendar_sources s
    join private.calendar_addresses a on a.source_id = s.id
    left join public.user_settings u on u.user_id = s.user_id
   where s.enabled and (only_user is null or s.user_id = only_user)
   order by s.last_sync_at nulls first;
$$;
revoke all on function public.calendar_jobs(uuid) from public, anon, authenticated;
grant execute on function public.calendar_jobs(uuid) to service_role;

-- Stores what calendar-sync read for one calendar: either its events (they
-- replace the stored ones) or, with sync_error, the reason it failed (the
-- events from before are kept). Only the server may call it.
--   events: [{ uid, all_day, starts_at, ends_at, start_day, end_day, title, location, link }]
create or replace function public.store_calendar_events(source uuid, events jsonb, sync_error text default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid;
  stored integer;
begin
  select s.user_id into owner from public.calendar_sources s where s.id = source;
  if owner is null then
    return 0;
  end if;
  if sync_error is not null then
    update public.calendar_sources set last_error = left(sync_error, 200), last_sync_at = now() where id = source;
    return 0;
  end if;
  delete from public.calendar_events where source_id = source;
  insert into public.calendar_events (source_id, user_id, uid, all_day, starts_at, ends_at, start_day, end_day, title, location, link)
  select source, owner, coalesce(left(e.uid, 500), ''), e.all_day, e.starts_at, e.ends_at, e.start_day, e.end_day,
         left(coalesce(e.title, ''), 300), left(coalesce(e.location, ''), 300), left(coalesce(e.link, ''), 1000)
    from jsonb_to_recordset(coalesce(events, '[]'::jsonb)) as e(uid text, all_day boolean, starts_at timestamptz, ends_at timestamptz, start_day date, end_day date, title text, location text, link text)
   limit 500;
  get diagnostics stored = row_count;
  update public.calendar_sources set last_sync_at = now(), last_error = null, event_count = stored where id = source;
  return stored;
end;
$$;
revoke all on function public.store_calendar_events(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.store_calendar_events(uuid, jsonb, text) to service_role;

-- The scheduler reads all calendars every 15 minutes (same project address
-- and token as send-reminders). `select cron.unschedule('calendar-sync');` stops it.
select cron.schedule(
  'calendar-sync',
  '4,19,34,49 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $job$
);

-- Settings → Modules → Calendar: the Calendar card on Dawn (on to start with).
alter table public.user_settings
  add column calendar_display text not null default 'section' check (calendar_display in ('off', 'section'));
comment on column public.user_settings.calendar_display is 'v3.9: the Calendar card on Dawn (section) or hidden (off).';

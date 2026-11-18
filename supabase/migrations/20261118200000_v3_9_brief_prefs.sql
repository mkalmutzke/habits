-- Version 3.9, step 27: the daily briefs become configurable from the app
-- (owner, 18 Nov 2026). Settings → Daily briefs stores, per brief: whether
-- its icon shows, its title, the countries / job titles / regions / symbols
-- to follow, the topics, things to leave out, a short "about me" (jobs) and
-- the number of items. brief_context() hands them to brief-ingest, which
-- passes them – cleaned up (_shared/briefPrefs.js) – to the morning run.
-- An empty object means "as before". Additive only (rollback-safe).

alter table public.user_settings
  add column brief_prefs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(brief_prefs) = 'object' and pg_column_size(brief_prefs) <= 16384);
comment on column public.user_settings.brief_prefs is 'v3.9: settings of the daily briefs { ibkr, jobs, world } (icon, title, lists, topics, about, max, extra).';

-- As in v3.6, plus `prefs` (the owner's brief_prefs).
create or replace function public.brief_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner uuid := private.brief_owner();
  zone text;
  settings record;
  snapshot record;
begin
  select coalesce(s.time_zone, 'UTC') as time_zone, coalesce(s.brief_ibkr_on, true) as ibkr,
         coalesce(s.brief_jobs_on, true) as jobs, coalesce(s.brief_world_on, true) as world,
         coalesce(s.brief_prefs, '{}'::jsonb) as prefs
    into settings
    from (select 1) one
    left join public.user_settings s on s.user_id = owner;
  zone := settings.time_zone;
  select p.id, p.as_of into snapshot
    from public.portfolio_snapshots p
   where p.user_id = owner
   order by p.as_of desc
   limit 1;
  return jsonb_build_object(
    'today', (now() at time zone zone)::date,
    'time_zone', zone,
    'on', jsonb_build_object('ibkr', settings.ibkr, 'jobs', settings.jobs, 'world', settings.world),
    'prefs', settings.prefs,
    'holdings_as_of', snapshot.as_of,
    'holdings', coalesce((
      select jsonb_agg(jsonb_build_object('symbol', pos.symbol, 'description', pos.description, 'asset_class', pos.asset_class) order by pos.value_base desc nulls last)
        from public.portfolio_positions pos
       where pos.snapshot_id = snapshot.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.brief_context() from public, anon, authenticated;
grant execute on function public.brief_context() to service_role;

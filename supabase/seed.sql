-- Local development only (runs after `supabase db reset`, never in the cloud):
-- the address where the scheduler reaches the Edge Functions inside Docker.
select vault.create_secret('http://supabase_kong_habit-tracker:8000', 'project_url', 'Base address for the scheduler (local)')
 where not exists (select 1 from vault.secrets where name = 'project_url');

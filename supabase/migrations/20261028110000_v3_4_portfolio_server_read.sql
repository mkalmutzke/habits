-- Version 3.4 fix: the Edge Function ibkr-sync first reads the newest snapshot
-- date (so the retry run can skip a day already stored). The server role needs
-- read access for that, like the other tables the functions read
-- (user_settings, todo_tasks). Found on habits-test: the first run ended with
-- "permission denied". Writing stays with store_portfolio_snapshot only.
grant select on table public.portfolio_snapshots to service_role;

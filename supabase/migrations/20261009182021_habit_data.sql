-- One row per user, holding that user's whole habit data as versioned JSON
-- (the same { version, updatedAt, habits } format the app saves on the device).
create table public.habit_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  version integer not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.habit_data is 'Habit tracker data, one row per user (versioned JSON).';

-- Row level security: every signed-in user can only ever see and change their own row.
alter table public.habit_data enable row level security;

create policy "Users can read their own habit data"
  on public.habit_data for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own habit data"
  on public.habit_data for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own habit data"
  on public.habit_data for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Table access, granted explicitly. Older projects still hand out broad default
-- grants on new tables (incl. TRUNCATE, which ignores row level security), so
-- first remove everything, then allow only what the app needs: signed-in users
-- may read, create and update (their own row, via the policies above).
-- Visitors who are not signed in (anon) get no access at all.
revoke all on table public.habit_data from anon, authenticated;
grant select, insert, update on table public.habit_data to authenticated;

-- Version 3.6, step 1: habit groups (owner, 1 Nov 2026). Habits can be put in
-- a group (e.g. Sport, Dog); What's up? shows one foldable bar per group.
-- A habit without a group (group_id empty) belongs to the default group,
-- whose name is a setting (user_settings.default_habit_group, "Other") – so
-- the default group always exists, can be renamed but not deleted, and
-- deleting a group simply moves its habits there (on delete set null).
-- Same rules as the other tables: own rows only, explicit grants, updated_at
-- and live-update triggers. Additive only (rollback-safe).

create table public.habit_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- target for the composite foreign key of habits.group_id
  unique (id, user_id)
);
comment on table public.habit_groups is 'v3.6: groups of habits (Sport, Dog, …); habits without a group are in the default group.';
create index habit_groups_user_id_idx on public.habit_groups (user_id);

create trigger habit_groups_touch before update on public.habit_groups
  for each row execute function private.touch_updated_at();
create trigger habit_groups_broadcast after insert or update or delete on public.habit_groups
  for each row execute function private.broadcast_change();

alter table public.habit_groups enable row level security;
create policy "Own habit groups" on public.habit_groups for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.habit_groups from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.habit_groups to authenticated;

-- A habit's group; empty = the default group. The composite key makes sure a
-- habit can only point to a group of the same user.
alter table public.habits add column group_id uuid;
alter table public.habits
  add constraint habits_group_fkey foreign key (group_id, user_id)
  references public.habit_groups (id, user_id) on delete set null (group_id);
create index habits_group_idx on public.habits (group_id, user_id);
comment on column public.habits.group_id is 'v3.6: the habit''s group; empty = the default group.';

-- The name of the default group (renamable in Settings).
alter table public.user_settings
  add column default_habit_group text not null default 'Other'
  check (char_length(default_habit_group) between 1 and 40);
comment on column public.user_settings.default_habit_group is 'v3.6: name of the default habit group (habits without a group).';

-- The owner's first groups (accounts that exist when this runs; in practice
-- only the owner). Existing habits stay in the default group.
insert into public.habit_groups (user_id, name, position)
select u.id, g.name, g.position
  from auth.users u
 cross join (values ('Sport', 1), ('Dog', 2)) as g (name, position);

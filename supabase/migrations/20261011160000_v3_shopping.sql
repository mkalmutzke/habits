-- Version 3, increment 3: the shopping list on the Week page (design v3 §2.5,
-- §5.1). Plain text items, ticked or not – no lists, dates or reminders.
-- Same rules as the v2 tables: own rows only, explicit grants, updated_at and
-- live-update triggers. Additive only (rollback-safe).

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  -- empty = not ticked; ticked items are shown struck through at the bottom
  ticked_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.shopping_items is 'Shopping list items (v3): plain text, ticked or not.';
create index shopping_items_user_id_idx on public.shopping_items (user_id);

create trigger shopping_items_touch before update on public.shopping_items
  for each row execute function private.touch_updated_at();
create trigger shopping_items_broadcast after insert or update or delete on public.shopping_items
  for each row execute function private.broadcast_change();

alter table public.shopping_items enable row level security;
create policy "Own shopping items" on public.shopping_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.shopping_items from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.shopping_items to authenticated;

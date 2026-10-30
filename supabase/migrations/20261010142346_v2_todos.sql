-- Version 2, part 2: the to-do list (inspired by Microsoft To Do, no sharing).
-- Same rules as part 1: own rows only, explicit grants, composite foreign keys,
-- updated_at and live-update triggers.

-- ---------------------------------------------------------------------------
-- Groups (folders) for lists
create table public.todo_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position double precision not null default 0,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
comment on table public.todo_groups is 'Folders that hold to-do lists.';
create index todo_groups_user_id_idx on public.todo_groups (user_id);

-- Lists; group_id empty = not in a group. Deleting a group keeps its lists.
create table public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '📋' check (char_length(emoji) between 1 and 16),
  color text not null default 'amber'
    check (color in ('amber', 'teal', 'green', 'coral', 'violet', 'blue')),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (group_id, user_id) references public.todo_groups (id, user_id)
    on delete set null (group_id)
);
comment on table public.todo_lists is 'To-do lists, optionally inside a group.';
create index todo_lists_user_id_idx on public.todo_lists (user_id);
create index todo_lists_group_idx on public.todo_lists (group_id, user_id);

-- Tasks; list_id empty = the built-in "Tasks" list.
create table public.todo_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id uuid,
  title text not null check (char_length(title) between 1 and 255),
  notes text not null default '' check (char_length(notes) <= 10000),
  due_date date,
  important boolean not null default false,
  -- the day this task was added to "My Day" (it leaves My Day by itself the next day)
  my_day_on date,
  -- e.g. {"freq":"weekly","interval":1,"weekdays":[0,2]} – see src/features/todos/repeat.js
  repeat_rule jsonb check (
    repeat_rule is null
    or (jsonb_typeof(repeat_rule) = 'object'
        and repeat_rule ->> 'freq' in ('daily', 'weekly', 'monthly', 'yearly')
        and coalesce((repeat_rule ->> 'interval')::int, 1) between 1 and 365)
  ),
  completed_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (list_id, user_id) references public.todo_lists (id, user_id) on delete cascade
);
comment on table public.todo_tasks is 'Tasks (to-dos).';
create index todo_tasks_user_id_idx on public.todo_tasks (user_id);
create index todo_tasks_list_idx on public.todo_tasks (list_id, user_id);

-- Steps (sub-tasks) of a task
create table public.todo_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  title text not null check (char_length(title) between 1 and 255),
  done boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.todo_tasks (id, user_id) on delete cascade
);
comment on table public.todo_steps is 'Steps (sub-tasks) of a task.';
create index todo_steps_user_id_idx on public.todo_steps (user_id);
create index todo_steps_task_idx on public.todo_steps (task_id, user_id);

-- ---------------------------------------------------------------------------
-- Triggers
create trigger todo_groups_touch before update on public.todo_groups
  for each row execute function private.touch_updated_at();
create trigger todo_lists_touch before update on public.todo_lists
  for each row execute function private.touch_updated_at();
create trigger todo_tasks_touch before update on public.todo_tasks
  for each row execute function private.touch_updated_at();
create trigger todo_steps_touch before update on public.todo_steps
  for each row execute function private.touch_updated_at();

create trigger todo_groups_broadcast after insert or update or delete on public.todo_groups
  for each row execute function private.broadcast_change();
create trigger todo_lists_broadcast after insert or update or delete on public.todo_lists
  for each row execute function private.broadcast_change();
create trigger todo_tasks_broadcast after insert or update or delete on public.todo_tasks
  for each row execute function private.broadcast_change();
create trigger todo_steps_broadcast after insert or update or delete on public.todo_steps
  for each row execute function private.broadcast_change();

-- ---------------------------------------------------------------------------
-- Row level security and grants
alter table public.todo_groups enable row level security;
alter table public.todo_lists enable row level security;
alter table public.todo_tasks enable row level security;
alter table public.todo_steps enable row level security;

create policy "Own groups" on public.todo_groups for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own lists" on public.todo_lists for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own tasks" on public.todo_tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own steps" on public.todo_steps for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.todo_groups, public.todo_lists, public.todo_tasks, public.todo_steps
  from public, anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.todo_groups, public.todo_lists, public.todo_tasks, public.todo_steps
  to authenticated;
-- reminder function (part 3) reads task titles
grant select on table public.todo_tasks to service_role;

-- ---------------------------------------------------------------------------
-- Completing a repeating task: mark it done and create the next one (with its
-- steps, unticked) in one step, so there is never a done task without its
-- successor. The app calculates the next due date (src/features/todos/repeat.js)
-- and passes the new task's id. Runs with the caller's rights: row level
-- security applies to every statement.
create or replace function public.complete_repeating_task(task_id uuid, next_id uuid, next_due date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  done_task public.todo_tasks;
begin
  update public.todo_tasks
     set completed_at = now()
   where id = task_id and completed_at is null and repeat_rule is not null
  returning * into done_task;
  if not found then
    raise exception 'task not found, already done or not repeating' using errcode = 'P0002';
  end if;

  insert into public.todo_tasks (id, user_id, list_id, title, notes, due_date, important, my_day_on, repeat_rule, position)
  values (next_id, done_task.user_id, done_task.list_id, done_task.title, done_task.notes, next_due,
          done_task.important, null, done_task.repeat_rule, done_task.position);

  insert into public.todo_steps (user_id, task_id, title, done, position)
  select s.user_id, next_id, s.title, false, s.position
    from public.todo_steps s
   where s.task_id = done_task.id;
end;
$$;
revoke all on function public.complete_repeating_task(uuid, uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.complete_repeating_task(uuid, uuid, date) to authenticated;

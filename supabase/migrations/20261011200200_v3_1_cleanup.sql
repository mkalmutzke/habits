-- Version 3.1: clean-up (owner, change note 05 #6). Removes what v3 no longer
-- uses. NOT additive – apply only after the app that doesn't use these is
-- live (v3.1.0). The v1 data is kept outside the database as a JSON backup.

-- Repeating tasks: the same function without the v2 "My Day" column. Must be
-- replaced before the column is dropped.
create or replace function public.complete_repeating_task(task_id uuid, next_id uuid, next_due date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  done_task public.todo_tasks;
  old_reminder public.todo_reminders;
begin
  update public.todo_tasks
     set completed_at = now()
   where id = task_id and completed_at is null and repeat_rule is not null
  returning * into done_task;
  if not found then
    raise exception 'task not found, already done or not repeating' using errcode = 'P0002';
  end if;

  insert into public.todo_tasks (id, user_id, list_id, title, notes, due_date, important, repeat_rule, position)
  values (next_id, done_task.user_id, done_task.list_id, done_task.title, done_task.notes, next_due,
          done_task.important, done_task.repeat_rule, done_task.position);

  insert into public.todo_steps (user_id, task_id, title, done, position)
  select s.user_id, next_id, s.title, false, s.position
    from public.todo_steps s
   where s.task_id = done_task.id;

  select * into old_reminder from public.todo_reminders r where r.task_id = done_task.id;
  if found then
    insert into public.todo_reminders (user_id, task_id, remind_at, channels)
    values (done_task.user_id, next_id,
            old_reminder.remind_at + make_interval(days => next_due - coalesce(done_task.due_date, current_date)),
            old_reminder.channels);
  end if;
end;
$$;
revoke all on function public.complete_repeating_task(uuid, uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.complete_repeating_task(uuid, uuid, date) to authenticated;

-- v2 "My Day" (removed in v3) and list emojis (lists show a colour dot since v3)
alter table public.todo_tasks drop column my_day_on;
alter table public.todo_lists drop column emoji;

-- the v1 table (one JSON row per user; v2 started empty and never used it)
drop table public.habit_data;

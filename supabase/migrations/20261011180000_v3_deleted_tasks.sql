-- Version 3, increment 5: deleted tasks are kept for 10 days (design v3 §5.3,
-- owner decision D1). "Delete" sets deleted_at; the app shows them greyed out
-- with Restore (Settings switch "Show deleted tasks", default on); a daily
-- job removes them for good after 10 days. Additive only (rollback-safe).

alter table public.todo_tasks add column deleted_at timestamptz;
comment on column public.todo_tasks.deleted_at is 'v3: when the task was deleted (kept 10 days, then removed by purge-deleted-tasks).';
create index todo_tasks_deleted_idx on public.todo_tasks (deleted_at) where deleted_at is not null;

alter table public.user_settings add column show_deleted_tasks boolean not null default true;

-- Reminders of deleted tasks are not sent: a deleted task counts like a done
-- one (the function cancels the reminder). Same function as in v2 part 3,
-- only `task_done` changes.
create or replace function public.claim_due_reminders(max_count integer default 50)
returns table (
  reminder_id uuid,
  user_id uuid,
  task_id uuid,
  remind_at timestamptz,
  channels text[],
  attempts integer,
  task_title text,
  task_done boolean,
  time_zone text,
  inapp_on boolean,
  email_on boolean,
  quiet_start time,
  quiet_end time
)
language sql
security invoker
set search_path = ''
as $$
  with due as (
    select r.id
      from public.todo_reminders r
     where r.remind_at <= now()
       and (r.status = 'pending' or (r.status = 'sending' and r.updated_at < now() - interval '10 minutes'))
     order by r.remind_at
     limit max_count
     for update skip locked
  ), claimed as (
    update public.todo_reminders r
       set status = 'sending', attempts = r.attempts + 1
      from due
     where r.id = due.id
    returning r.*
  )
  select c.id, c.user_id, c.task_id, c.remind_at, c.channels, c.attempts,
         t.title, (t.completed_at is not null or t.deleted_at is not null),
         coalesce(s.time_zone, 'UTC'), coalesce(s.inapp_on, true), coalesce(s.email_on, false),
         s.quiet_start, s.quiet_end
    from claimed c
    join public.todo_tasks t on t.id = c.task_id
    left join public.user_settings s on s.user_id = c.user_id;
$$;
revoke all on function public.claim_due_reminders(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_due_reminders(integer) to service_role;

-- Once a day: tasks deleted more than 10 days ago go for good (their steps
-- and reminder with them, through the existing cascades).
select cron.schedule(
  'purge-deleted-tasks',
  '23 3 * * *',
  $job$
  delete from public.todo_tasks where deleted_at < now() - interval '10 days';
  $job$
);

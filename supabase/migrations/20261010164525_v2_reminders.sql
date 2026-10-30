-- Version 2, part 3: reminders (in-app, push, email), push subscriptions per
-- device, a delivery log, and the scheduler that calls the Edge Function
-- send-reminders every minute.

-- ---------------------------------------------------------------------------
-- Index promised by the advisor review
create index if not exists habit_completions_habit_user_idx on public.habit_completions (habit_id, user_id);

-- ---------------------------------------------------------------------------
-- One reminder per task. Users choose time and channels; the status columns
-- are written by the server only.
create table public.todo_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  remind_at timestamptz not null,
  channels text[] not null default array['inapp', 'push']
    check (cardinality(channels) between 1 and 3 and channels <@ array['inapp', 'push', 'email']),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one reminder per task; (task, owner) so that another user never learns
  -- from an error message that a task of someone else has a reminder
  unique (task_id, user_id),
  foreign key (task_id, user_id) references public.todo_tasks (id, user_id) on delete cascade
);
comment on table public.todo_reminders is 'A reminder for a task (one per task).';
create index todo_reminders_user_id_idx on public.todo_reminders (user_id);
create index todo_reminders_due_idx on public.todo_reminders (remind_at) where status in ('pending', 'sending');

-- Push subscriptions: one row per device where push is switched on.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  device_label text not null default '' check (char_length(device_label) <= 100),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- per owner: the same browser can be used by two people one after the other
  unique (endpoint, user_id)
);
comment on table public.push_subscriptions is 'Web push subscription of one device.';
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- What was sent, for the user to see and for support. Kept 30 days.
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_id uuid,
  task_id uuid,
  channel text not null check (channel in ('inapp', 'push', 'email', 'test')),
  result text not null check (result in ('sent', 'failed', 'skipped')),
  detail text not null default '' check (char_length(detail) <= 500),
  created_at timestamptz not null default now()
);
comment on table public.notification_log is 'Delivery log of reminders (server-written, 30 days).';
create index notification_log_user_idx on public.notification_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- New reminders always start as pending (whatever the client sends). When the
-- *user* changes time or channels, the reminder is due again from scratch;
-- when the server moves it (retry, quiet hours), it keeps its attempt count.
create or replace function private.reset_reminder_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or (current_user <> 'service_role'
         and (new.remind_at is distinct from old.remind_at or new.channels is distinct from old.channels)) then
    new.status := 'pending';
    new.attempts := 0;
    new.last_error := null;
    new.sent_at := null;
  end if;
  return new;
end;
$$;

create trigger todo_reminders_reset before insert or update on public.todo_reminders
  for each row execute function private.reset_reminder_status();
create trigger todo_reminders_touch before update on public.todo_reminders
  for each row execute function private.touch_updated_at();
create trigger todo_reminders_broadcast after insert or update or delete on public.todo_reminders
  for each row execute function private.broadcast_change();
create trigger push_subscriptions_broadcast after insert or update or delete on public.push_subscriptions
  for each row execute function private.broadcast_change();

-- ---------------------------------------------------------------------------
-- Row level security and grants
alter table public.todo_reminders enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

create policy "Own reminders" on public.todo_reminders for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own push subscriptions" on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Read own notification log" on public.notification_log for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.todo_reminders, public.push_subscriptions, public.notification_log
  from public, anon, authenticated, service_role;
-- users: only the columns they may set (the status is the server's)
grant select, delete on table public.todo_reminders to authenticated;
grant insert (id, user_id, task_id, remind_at, channels) on table public.todo_reminders to authenticated;
grant update (remind_at, channels) on table public.todo_reminders to authenticated;
grant select, insert, delete on table public.push_subscriptions to authenticated;
grant select on table public.notification_log to authenticated;
-- the reminder function (service role)
grant select, update on table public.todo_reminders to service_role;
grant select, update, delete on table public.push_subscriptions to service_role;
grant select, insert on table public.notification_log to service_role;

-- ---------------------------------------------------------------------------
-- Repeating tasks: the next task gets the reminder too, moved by as many days
-- as the due date moved. (Replaces the function from part 2.)
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

  insert into public.todo_tasks (id, user_id, list_id, title, notes, due_date, important, my_day_on, repeat_rule, position)
  values (next_id, done_task.user_id, done_task.list_id, done_task.title, done_task.notes, next_due,
          done_task.important, null, done_task.repeat_rule, done_task.position);

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

-- ---------------------------------------------------------------------------
-- Server side: only the service role (Edge Functions) may call these.

-- Claims up to `max_count` due reminders for sending. "for update skip locked"
-- means two overlapping runs never get the same reminder. A reminder stuck in
-- 'sending' for 10 minutes (crashed run) is picked up again.
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
         t.title, t.completed_at is not null,
         coalesce(s.time_zone, 'UTC'), coalesce(s.inapp_on, true), coalesce(s.email_on, false),
         s.quiet_start, s.quiet_end
    from claimed c
    join public.todo_tasks t on t.id = c.task_id
    left join public.user_settings s on s.user_id = c.user_id;
$$;
revoke all on function public.claim_due_reminders(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_due_reminders(integer) to service_role;

-- The scheduler proves itself with a random token that only exists in this
-- database's Vault (created below, never shown to anyone). The Edge Function
-- asks the database whether a token is right.
create or replace function public.check_cron_token(token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'reminders_cron_token' and decrypted_secret = token
  );
$$;
revoke all on function public.check_cron_token(text) from public, anon, authenticated, service_role;
grant execute on function public.check_cron_token(text) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'reminders_cron_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'reminders_cron_token',
                                'Token the scheduler sends to the send-reminders function');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduler: every minute, POST to send-reminders. The project's address is a
-- Vault secret 'project_url' set once per environment;
-- without it the job does nothing.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reminders',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $job$
);

-- Housekeeping once a day: delivery log older than 30 days, old cron history.
select cron.schedule(
  'cleanup-notification-log',
  '17 3 * * *',
  $job$
  delete from public.notification_log where created_at < now() - interval '30 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  $job$
);

-- Version 3.0.3: fix for habit reminders found in the owner's production test.
-- Before, "starts tomorrow" (created after its time) and "sent today" were both
-- stored in last_sent_on – so moving the time to later today kept the
-- reminder silent until tomorrow, while the app's in-app pop-up did come.
-- Now: starts_on = the first day to remind (set when the user creates or
-- changes the reminder); last_sent_on = only the day it was really handled
-- by the server. Additive (a new column, replaced functions).

alter table public.habit_reminders add column starts_on date;
comment on column public.habit_reminders.starts_on is
  'First local day to remind: today, or tomorrow if created/changed after its time today (v3.0.3).';

-- When the *user* creates or changes time, channels or switch: start today if
-- the time is still to come, else tomorrow. last_sent_on is not touched – a
-- reminder already sent today is not sent twice.
create or replace function private.prepare_habit_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  local timestamp := private.local_now(new.user_id);
begin
  if tg_op = 'INSERT'
     or (session_user <> 'service_role' and current_setting('role', true) <> 'service_role'
         and (new.remind_time is distinct from old.remind_time
              or new.channels is distinct from old.channels
              or new.active is distinct from old.active)) then
    new.attempts := 0;
    new.claimed_at := null;
    new.retry_at := null;
    new.starts_on := case when local::time >= new.remind_time then local::date + 1 else local::date end;
  end if;
  return new;
end;
$$;

-- Same claim as before, plus: not before its first day.
create or replace function public.claim_due_habit_reminders(max_count integer default 50)
returns table (
  reminder_id uuid,
  user_id uuid,
  habit_id uuid,
  habit_name text,
  habit_emoji text,
  local_day date,
  channels text[],
  attempts integer,
  time_zone text,
  inapp_on boolean,
  email_on boolean,
  quiet_start time,
  quiet_end time
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select r.id, private.local_now(r.user_id)::date as local_day
      from public.habit_reminders r
     where r.active
       and (r.claimed_at is null or r.claimed_at < now() - interval '10 minutes')
       and (r.retry_at is null or r.retry_at <= now())
       and (r.starts_on is null or r.starts_on <= private.local_now(r.user_id)::date)
       and private.local_now(r.user_id)::time >= r.remind_time
       and (r.last_sent_on is null or r.last_sent_on < private.local_now(r.user_id)::date)
       and not exists (
         select 1 from public.habit_completions c
          where c.habit_id = r.habit_id and c.day = private.local_now(r.user_id)::date)
     order by r.remind_time
     limit max_count
     for update of r skip locked
  ), claimed as (
    update public.habit_reminders r
       set claimed_at = now(), attempts = r.attempts + 1
      from due
     where r.id = due.id
    returning r.*, due.local_day
  )
  select c.id, c.user_id, c.habit_id, h.name, h.emoji, c.local_day, c.channels, c.attempts,
         private.safe_time_zone(s.time_zone), coalesce(s.inapp_on, true), coalesce(s.email_on, false),
         s.quiet_start, s.quiet_end
    from claimed c
    join public.habits h on h.id = c.habit_id
    left join public.user_settings s on s.user_id = c.user_id;
$$;
revoke all on function public.claim_due_habit_reminders(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_due_habit_reminders(integer) to service_role;

-- Existing reminders (one each in test and production): the first day from
-- their last change, and last_sent_on cleared where nothing was ever sent for
-- the habit (it was only the old "starts tomorrow" mark).
update public.habit_reminders r
   set starts_on = case
         when (r.updated_at at time zone private.safe_time_zone(s.time_zone))::time >= r.remind_time
           then (r.updated_at at time zone private.safe_time_zone(s.time_zone))::date + 1
         else (r.updated_at at time zone private.safe_time_zone(s.time_zone))::date
       end,
       last_sent_on = case
         when exists (select 1 from public.notification_log l where l.habit_id = r.habit_id) then r.last_sent_on
         else null
       end
  from public.user_settings s
 where s.user_id = r.user_id;

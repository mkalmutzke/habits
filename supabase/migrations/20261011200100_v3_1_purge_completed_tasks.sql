-- Version 3.1: housekeeping (owner, change note 05 #2). Once a day, tasks
-- completed more than 360 days ago are removed for good – their steps and
-- reminder go with them through the existing cascades. Open tasks are never
-- touched. Additive: `select cron.unschedule('purge-completed-tasks');` stops it.
select cron.schedule(
  'purge-completed-tasks',
  '29 3 * * *',
  $job$
  delete from public.todo_tasks where completed_at < now() - interval '360 days';
  $job$
);

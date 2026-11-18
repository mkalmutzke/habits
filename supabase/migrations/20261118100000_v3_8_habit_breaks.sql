-- Version 3.8, step 16: breaks for habits (owner, 18 Nov 2026). A day of a
-- habit is now done or a break: tap once = done, again = break, again =
-- cleared (the row is deleted, as before). A break keeps the streak but does
-- not add to it; three breaks in a row end it (the app works that out).
-- Rows from before v3.8 are done days. The send-reminders function skips a
-- habit whenever it has a row for the day, so a break day gets no reminder.
-- Optional limit (Settings): breaks per habit and calendar month; empty = no
-- limit (owner: start without one).
-- Additive only (rollback-safe): the live v3.7 app ignores the new column and
-- would show a break day as done.

alter table public.habit_completions
  add column status text not null default 'done' check (status in ('done', 'break'));
comment on column public.habit_completions.status is 'v3.8: done, or break (keeps the streak, three in a row end it).';
comment on table public.habit_completions is 'One row per habit and day it was done or (v3.8) marked as a break.';

-- done ↔ break is an update of this one column; the row's key stays.
grant update (status) on table public.habit_completions to authenticated;

alter table public.user_settings
  add column habit_break_limit smallint check (habit_break_limit between 1 and 31);
comment on column public.user_settings.habit_break_limit is 'v3.8: breaks allowed per habit and calendar month; empty = no limit.';

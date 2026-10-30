// The tables of the database, for "How it's built" → Database. Kept in one
// place so it's easy to keep current; a test checks that every table the app
// loads (src/shared/data/tables.js) is described here.
export const DATABASE_TABLES = [
  { group: 'Habits', name: 'habits', what: 'Your habits', columns: 'name · subtitle (v3.1) · emoji · position (v3.3: drag to reorder)', since: 'v2' },
  { group: 'Habits', name: 'habit_completions', what: 'One row per habit and ticked day', columns: 'habit_id · day', since: 'v2' },
  { group: 'Habits', name: 'habit_reminders', what: 'Daily reminder of a habit – only if not done that day', columns: 'habit_id · remind_time · channels · starts_on · last_sent_on', since: 'v3' },
  { group: 'To-dos', name: 'todo_groups', what: 'Groups (folders) of lists', columns: 'name · collapsed · position', since: 'v2' },
  { group: 'To-dos', name: 'todo_lists', what: 'Your lists', columns: 'name · color · group_id · show_in_all (v3.3) · position', since: 'v2' },
  { group: 'To-dos', name: 'todo_tasks', what: 'Tasks; deleted ones are kept 10 days, completed ones 360 days', columns: 'title · list_id · due_date · important · repeat_rule · completed_at · deleted_at', since: 'v2' },
  { group: 'To-dos', name: 'todo_steps', what: 'Steps of a task', columns: 'task_id · title · done', since: 'v2' },
  { group: 'To-dos', name: 'todo_reminders', what: 'One reminder per task, at a moment', columns: 'task_id · remind_at · channels · status', since: 'v2' },
  { group: 'Week', name: 'shopping_items', what: 'The shopping list', columns: 'title · ticked_at · position', since: 'v3' },
  { group: 'IBKR', name: 'portfolio_snapshots', what: 'One snapshot of your IBKR portfolio per trading day (kept 400 days), written by the server', columns: 'as_of · nav · cash · day_change · day_twr · twr (YTD)', since: 'v3.4' },
  { group: 'IBKR', name: 'portfolio_positions', what: 'The holdings of a snapshot (kept 7 days), in CHF', columns: 'symbol · quantity · value_base · prev_close_price · cost_basis_base', since: 'v3.4' },
  { group: 'Garmin', name: 'garmin_days', what: 'One Garmin daily summary per day (kept 365 days), written by the server', columns: 'day · steps · step_goal · resting_hr', since: 'v3.5' },
  { group: 'Garmin', name: 'garmin_activities', what: 'Your Garmin activities (kept 365 days), written by the server', columns: 'day · activity_type · moving_s · duration_s · distance_m', since: 'v3.5' },
  { group: 'You', name: 'user_settings', what: 'Time zone, reminder channels, quiet hours, show deleted tasks', columns: 'time_zone · inapp_on · email_on · quiet_start/end · show_deleted_tasks', since: 'v2' },
  { group: 'You', name: 'push_subscriptions', what: 'Devices with push switched on', columns: 'endpoint · device_label · last_used_at', since: 'v2' },
  { group: 'You', name: 'notification_log', what: 'What the server sent (kept 30 days)', columns: 'channel · result · task_id / habit_id', since: 'v2' },
]

// How the tables hang together (shown under the list).
export const RELATIONS = [
  'habits → habit_completions, habit_reminders',
  'todo_groups → todo_lists → todo_tasks → todo_steps, todo_reminders',
  'portfolio_snapshots → portfolio_positions',
  'garmin_days, garmin_activities (one row per day / per activity)',
  'every table → your account (user_id), deleted with it',
]

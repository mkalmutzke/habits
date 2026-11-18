import { insert, localOnly, newId, remove, update } from '../../shared/data/changes.js'
import { addDays, toDateKey, toTimeKey } from '../../shared/utils/date.js'
import { byPosition } from '../../shared/utils/position.js'

// Pure helpers behind useHabits (no React), so they can be unit-tested.

// Habit rows plus check-off rows → the shape the screens use:
// { id, name, subtitle, emoji, position, createdAt, completions: ['YYYY-MM-DD', …],
//   breaks: ['YYYY-MM-DD', …] }
// v3.8: a check-off row is a done day or – with status 'break' – a break day
// (rows from before v3.8, or still being saved, have no status: done).
export function shapeHabits(habitRows, completionRows) {
  const byHabit = new Map()
  const breaksByHabit = new Map()
  for (const row of completionRows) {
    const target = row.status === 'break' ? breaksByHabit : byHabit
    if (!target.has(row.habit_id)) target.set(row.habit_id, [])
    target.get(row.habit_id).push(row.day)
  }
  return [...habitRows].sort(byPosition).map((row) => ({
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? '',
    emoji: row.emoji,
    position: row.position,
    createdAt: row.created_at,
    // v3.6: empty = the default group
    groupId: row.group_id ?? null,
    completions: byHabit.get(row.id) ?? [],
    breaks: breaksByHabit.get(row.id) ?? [],
  }))
}

// v3.6: the groups to show on What's up?, in order – the user's groups by
// position, then the default group (habits without a group, or whose group no
// longer exists). Empty groups are left out (owner). Each group:
// { id (null = default), name, habits, done } – done = ticked today (v3.8:
// or on a break today).
export function groupHabits(habits, groupRows, defaultName, today) {
  const ordered = [...groupRows].sort(byPosition)
  const known = new Set(ordered.map((group) => group.id))
  const groups = [
    ...ordered.map((group) => ({ id: group.id, name: group.name, habits: habits.filter((habit) => habit.groupId === group.id) })),
    { id: null, name: defaultName, habits: habits.filter((habit) => !known.has(habit.groupId)) },
  ]
  return groups
    .filter((group) => group.habits.length > 0)
    .map((group) => ({ ...group, done: group.habits.filter((habit) => isMarked(habit, today)).length }))
}

// v3.8 (owner): a day of a habit is done, a break, or nothing (null).
export function dayStatus(habit, day) {
  if (habit.completions.includes(day)) return 'done'
  if ((habit.breaks ?? []).includes(day)) return 'break'
  return null
}

// Done or a break – the day counts as looked after (the "x of y" counts, the
// month overview, the reminders).
export const isMarked = (habit, day) => dayStatus(habit, day) !== null

// Breaks of a habit in the calendar month of `day`, that day itself not counted.
export function breaksInMonth(habit, day) {
  const month = day.slice(0, 7)
  return (habit.breaks ?? []).filter((other) => other !== day && other.startsWith(month)).length
}

// What a tap on a day makes of it (owner): nothing → done → break → nothing.
// `breakLimit` (Settings, empty = no limit) is the number of breaks a habit
// may have per calendar month; once they are used up, a tap on a done day
// clears it, as before v3.8.
export function nextStatus(habit, day, breakLimit = null) {
  const status = dayStatus(habit, day)
  if (status === null) return 'done'
  if (status === 'done' && (breakLimit == null || breaksInMonth(habit, day) < breakLimit)) return 'break'
  return null
}

// The changes that give a habit's day the status `next` ('done', 'break' or
// null). The row's key is habit + day; clearing a day deletes its row.
export function dayChanges({ habit, day, next, userId }) {
  const current = dayStatus(habit, day)
  const match = { habit_id: habit.id, day }
  if (next === current) return []
  if (next === null) return [remove('habit_completions', match)]
  if (current === null) return [insert('habit_completions', { habit_id: habit.id, day, user_id: userId, status: next })]
  return [update('habit_completions', match, { status: next })]
}

// First day of a reminder set at `now`: today if its time is still to come,
// else tomorrow (the database trigger does the same with the user's time zone).
export function firstReminderDay(remindTime, now = new Date()) {
  const today = toDateKey(now)
  return toTimeKey(now) >= remindTime.slice(0, 5) ? addDays(today, 1) : today
}

// Does a stored reminder already say the same as the chosen one? (Same rule as
// the database trigger: a changed reminder starts again.)
function sameReminder(existing, values) {
  return existing.active && existing.remind_time.slice(0, 5) === values.remind_time.slice(0, 5) && existing.channels.join() === values.channels.join()
}

// What to save so a habit has exactly `reminder` ({ remind_time, channels }
// or null). `existing` is its stored reminder row, if any. The habit itself is
// saved before these changes, so a new habit exists before its reminder points to it.
export function reminderChanges({ habitId, userId, existing, reminder, now = new Date() }) {
  if (!reminder) return existing ? [remove('habit_reminders', existing.id)] : []
  const values = { remind_time: reminder.remind_time, channels: reminder.channels, active: true }
  if (existing && sameReminder(existing, values)) return []
  // the database sets starts_on itself (users may not send it); on screen
  // the row needs it at once for the in-app reminder
  const startsOn = (id) => localOnly(update('habit_reminders', id, { starts_on: firstReminderDay(values.remind_time, now) }))
  if (existing) return [update('habit_reminders', existing.id, values), startsOn(existing.id)]
  const id = newId()
  return [insert('habit_reminders', { id, user_id: userId, habit_id: habitId, ...values }), startsOn(id)]
}

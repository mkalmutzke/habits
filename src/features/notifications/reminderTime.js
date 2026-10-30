import { addDays, formatShortDate, formatWeekday, toDateKey, toTimeKey } from '../../shared/utils/date.js'

// Reminder times in the app: stored as exact moments (timestamptz), shown and
// edited in the device's local time.

const pad = (number) => String(number).padStart(2, '0')

// "09:00:00" → [9, 0]
function parseTime(time) {
  const [hours, minutes] = String(time ?? '09:00').split(':').map(Number)
  return [hours || 0, minutes || 0]
}

// A new reminder starts at the default time today – or tomorrow if that time
// has already passed (like Microsoft To Do).
export function defaultRemindAt(now, defaultTime) {
  const [hours, minutes] = parseTime(defaultTime)
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
  if (at <= now) at.setDate(at.getDate() + 1)
  return at
}

// For <input type="datetime-local">: "2026-10-12T14:00" in local time.
export function toLocalInputValue(iso) {
  const date = new Date(iso)
  return `${toDateKey(date)}T${toTimeKey(date)}`
}

// "2026-10-12T14:00" (local) → exact moment as ISO string, or null if invalid.
export function fromLocalInputValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const [, year, month, day, hours, minutes] = match.map(Number)
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

// "Today 14:00", "Tomorrow 09:00", "Mon 12 Oct 09:00"
export function describeReminder(iso, now = new Date()) {
  const date = new Date(iso)
  const key = toDateKey(date)
  const today = toDateKey(now)
  const time = toTimeKey(date)
  if (key === today) return `Today ${time}`
  if (key === addDays(today, 1)) return `Tomorrow ${time}`
  if (key === addDays(today, -1)) return `Yesterday ${time}`
  return `${formatWeekday(key)} ${formatShortDate(key)} ${time}`
}

// Channels a new reminder starts with: what is switched on.
export function defaultChannels(settings, pushOnThisDevice) {
  const channels = []
  if (settings.inapp_on) channels.push('inapp')
  if (pushOnThisDevice) channels.push('push')
  if (settings.email_on) channels.push('email')
  return channels.length ? channels : ['inapp']
}

// Should the open app pop up this reminder now? (in-app channel, due, not
// older than 15 minutes, task still open, not shown on this device before)
export const INAPP_WINDOW_MS = 15 * 60 * 1000

export function isDueInApp(reminder, task, now, alreadyShown) {
  if (!task || task.completed_at || task.deleted_at) return false
  if (!reminder.channels.includes('inapp')) return false
  if (reminder.status === 'cancelled') return false
  const at = new Date(reminder.remind_at).getTime()
  if (at > now.getTime() || at < now.getTime() - INAPP_WINDOW_MS) return false
  return !alreadyShown.has(`${reminder.id}@${reminder.remind_at}`)
}

// v3: should the open app pop up a habit's daily reminder now? (in-app
// channel, switched on, its time has come today, the habit isn't done today,
// not shown on this device today). Not before its first day (starts_on, set by
// the database: tomorrow if created or changed after its time) – the same
// rule as on the server (v3.0.3).
export function isHabitDueInApp(reminder, habit, now, alreadyShown) {
  if (!habit || !reminder.active || !reminder.channels.includes('inapp')) return false
  const today = toDateKey(now)
  if (habit.completions.includes(today)) return false
  const [hours, minutes] = parseTime(reminder.remind_time)
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
  if (now < at) return false
  if (reminder.starts_on && reminder.starts_on > today) return false
  return !alreadyShown.has(habitShownKey(reminder, today))
}

export function habitShownKey(reminder, dayKey) {
  return `habit:${reminder.id}@${dayKey}`
}

// "18:30:00" → "18:30" (for <input type="time">)
export function toTimeInputValue(time) {
  const [hours, minutes] = parseTime(time)
  return `${pad(hours)}:${pad(minutes)}`
}

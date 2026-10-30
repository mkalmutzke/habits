// All "which day is it?" decisions use the device's local time zone, not UTC.
// A check-off at 00:30 local time belongs to that new day, even though it may
// still be the previous day in UTC.

// Labels are formatted with toLocaleDateString on each call (not a formatter made
// once at start-up), so they always use the time zone the device has *now*,
// e.g. after travelling with the app open.
function format(dateKey, options) {
  return keyToNoon(dateKey).toLocaleDateString('en-GB', options)
}

// Dates are stored as "YYYY-MM-DD" strings for the day on the local clock.
export function toDateKey(date = new Date()) {
  return formatKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

// The time on the local clock as "HH:MM" (e.g. to compare with a reminder time).
export function toTimeKey(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// The time on the local clock in 12-hour form: "5:07 PM", "12:30 AM". Built by
// hand because browsers differ in the space before AM/PM.
export function formatTime12(date = new Date()) {
  const hours = date.getHours()
  return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}

// Turn year, month (1-12) and day into a "YYYY-MM-DD" key.
function formatKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Move a "YYYY-MM-DD" key by whole days. The math is done on the plain calendar
// date (a UTC date has no summer/winter time), so a day can't be skipped or repeated.
export function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return formatKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

// Local noon on a date key: safely inside that calendar day in any time zone,
// so it's a good moment to format when only the day matters.
function keyToNoon(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

// "2026-10-09" -> "Friday, 9 October"
export function formatDayLabel(dateKey) {
  const weekday = format(dateKey, { weekday: 'long' })
  return `${weekday}, ${format(dateKey, { day: 'numeric', month: 'long' })}`
}

// "2026-10-09" -> "Fri"
export function formatWeekday(dateKey) {
  return format(dateKey, { weekday: 'short' })
}

// "2026-10-09" -> "9 Oct"
export function formatShortDate(dateKey) {
  return format(dateKey, { day: 'numeric', month: 'short' })
}

// "2026-10-09" -> "October"
export function formatMonth(dateKey) {
  return format(dateKey, { month: 'long' })
}

// Day of the week for a date key: 0 = Monday ... 6 = Sunday.
export function weekdayIndex(dateKey) {
  return (keyToNoon(dateKey).getDay() + 6) % 7
}

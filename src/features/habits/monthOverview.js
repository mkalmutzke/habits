import { addDays, toDateKey, weekdayIndex } from '../../shared/utils/date.js'
import { dayStatus } from './habitData.js'

// The habit month overview (v3.8, owner): plain helpers, no React.

// "2026-11-18" → "2026-11-01"; `back` months earlier with `monthStart(day, 1)`.
export function monthStart(day, back = 0) {
  const [year, month] = day.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 - back, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// Every day of the month that starts on `first`.
export function monthDays(first) {
  const days = []
  for (let day = first; day.slice(0, 7) === first.slice(0, 7); day = addDays(day, 1)) days.push(day)
  return days
}

// The day a habit was added, on the local calendar (empty: always existed).
const addedOn = (habit) => (habit.createdAt ? toDateKey(new Date(habit.createdAt)) : '0000-00-00')

// One day of the month for the habits that existed on it:
//   state 'full'   – every habit done
//         'breaks' – every habit done or on a break, at least one break
//         'some'   – some habits done or on a break
//         'none'   – none; 'future' – after today; 'empty' – no habit existed yet
export function dayOverview(habits, day, today) {
  const existing = habits.filter((habit) => addedOn(habit) <= day)
  const done = existing.filter((habit) => dayStatus(habit, day) === 'done').length
  const breaks = existing.filter((habit) => dayStatus(habit, day) === 'break').length
  const total = existing.length
  let state = 'none'
  if (day > today) state = 'future'
  else if (total === 0) state = 'empty'
  else if (done === total) state = 'full'
  else if (done + breaks === total) state = 'breaks'
  else if (done + breaks > 0) state = 'some'
  return { day, state, done, breaks, total }
}

// A whole month: its days (with leading blanks for a Monday-first grid) and
// how many days were complete – all done, or done with breaks.
export function monthOverview(habits, first, today) {
  const days = monthDays(first).map((day) => dayOverview(habits, day, today))
  return {
    first,
    blanks: weekdayIndex(first),
    days,
    full: days.filter((day) => day.state === 'full').length,
    withBreaks: days.filter((day) => day.state === 'breaks').length,
  }
}

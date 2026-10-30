import { addDays, formatShortDate, formatWeekday } from '../../shared/utils/date.js'
import { byPosition } from '../../shared/utils/position.js'
import { isOpen } from '../todos/smartLists.js'

// "Due & overdue" on the Week page (design v3.3 §3.4): today and the next 6
// days (owner Q4: rolling, like the habit grid's "last 7 days").
export const DUE_DAYS = 7

const byDueThenOrder = (a, b) => a.due_date.localeCompare(b.due_date) || byPosition(a, b)

// Open tasks of every list (owner Q3: not filtered by "Show in All") that are
// overdue or due in the coming days:
//   { overdue: [tasks, oldest first], days: [{ day, tasks }] (only days with
//     tasks, in date order), counts: { overdue, week } }
export function dueSoon(tasks, today) {
  const last = addDays(today, DUE_DAYS - 1)
  const due = tasks.filter((task) => isOpen(task) && task.due_date && task.due_date <= last).sort(byDueThenOrder)
  const overdue = due.filter((task) => task.due_date < today)
  const days = []
  for (const task of due.filter((item) => item.due_date >= today)) {
    if (days.at(-1)?.day !== task.due_date) days.push({ day: task.due_date, tasks: [] })
    days.at(-1).tasks.push(task)
  }
  return { overdue, days, counts: { overdue: overdue.length, week: due.length - overdue.length } }
}

// Heading of one day: "Today · Wed 21 Oct", "Tomorrow · Thu 22 Oct", "Fri 23 Oct".
export function dueDayLabel(day, today) {
  const date = `${formatWeekday(day)} ${formatShortDate(day)}`
  if (day === today) return `Today · ${date}`
  if (day === addDays(today, 1)) return `Tomorrow · ${date}`
  return date
}

import { addDays, formatDayLabel, formatShortDate } from './shared/utils/date.js'

// The small line above the title: the date, the days the Dawn page covers
// (v3.8: today and the next 6 days, like its Due & overdue card – it said
// "Last 7 days" from the time habits were on the Week page) or the open tasks.
export function headerLine(view, today, openTasks) {
  if (view === 'lists') return `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'}`
  if (view === 'dawn') return `Today + next 6 days · ${formatShortDate(today)} – ${formatShortDate(addDays(today, 6))}`
  return formatDayLabel(today)
}

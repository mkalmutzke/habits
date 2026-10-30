import { getRollingDays } from './features/week/week.js'
import { formatDayLabel, formatShortDate } from './shared/utils/date.js'

// The small line above the title: the date, the last 7 days or the open tasks.
export function headerLine(view, today, openTasks) {
  if (view === 'lists') return `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'}`
  if (view === 'week') {
    const days = getRollingDays(today)
    return `Last 7 days · ${formatShortDate(days[0])} – ${formatShortDate(days[6])}`
  }
  return formatDayLabel(today)
}

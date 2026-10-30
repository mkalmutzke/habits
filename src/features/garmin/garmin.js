import { addDays, formatMonth, formatShortDate, formatTime12, formatWeekday, toDateKey, weekdayIndex } from '../../shared/utils/date.js'
import { getRollingDays } from '../week/week.js'

// The Garmin card's logic (v3.5): plain
// functions, no React. Rows come from the tables written by garmin-sync.

// No new fetch for longer than this means garmin-sync is not working (for
// example an expired key) – the footer turns amber.
export const STALE_AFTER_DAYS = 2

// Garmin's activity type keys, folded into a few groups for the card.
const GROUPS = [
  { label: 'Running', icon: '▲', match: (key) => key.includes('running') || key === 'treadmill' },
  { label: 'Cycling', icon: '◐', match: (key) => key.includes('cycling') || key.includes('biking') || key.includes('ride') },
  { label: 'Walking', icon: '●', match: (key) => key.includes('walking') },
  { label: 'Hiking', icon: '◆', match: (key) => key.includes('hiking') },
  { label: 'Swimming', icon: '≈', match: (key) => key.includes('swim') },
  { label: 'Strength', icon: '■', match: (key) => key.includes('strength') || key.includes('fitness_equipment') },
]
const OTHER = { label: 'Other', icon: '○' }

export const activityGroup = (typeKey = '') => GROUPS.find((group) => group.match(typeKey.toLowerCase())) ?? OTHER

// The days a view covers: the Week page's last 7 days, or the calendar month
// so far (owner G10).
export function viewDays(view, today) {
  if (view === 'week') return getRollingDays(today)
  const days = []
  for (let day = `${today.slice(0, 8)}01`; day <= today; day = addDays(day, 1)) days.push(day)
  return days
}

// Average of the values that exist, rounded; null when there are none.
export function average(values) {
  const present = values.filter((value) => value !== null && value !== undefined)
  return present.length ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length) : null
}

// Moving time (owner G4), or the duration where Garmin reports none.
const activitySeconds = (row) => Number(row.moving_s ?? row.duration_s ?? 0)

// Everything one view shows: a row per day, the two averages, and the
// activities per group (count and time, owner G5) with their total.
export function summarize(dayRows, activityRows, days) {
  const byDay = new Map(dayRows.map((row) => [row.day, row]))
  const perDay = days.map((day) => ({ day, steps: byDay.get(day)?.steps ?? null, restingHr: byDay.get(day)?.resting_hr ?? null }))
  const inView = activityRows.filter((row) => row.day >= days[0] && row.day <= days.at(-1))
  const groups = new Map()
  for (const row of inView) {
    const group = activityGroup(row.activity_type)
    const entry = groups.get(group.label) ?? { ...group, match: undefined, count: 0, seconds: 0 }
    entry.count += 1
    entry.seconds += activitySeconds(row)
    groups.set(group.label, entry)
  }
  const activities = [...groups.values()].sort((a, b) => b.seconds - a.seconds)
  return {
    perDay,
    stepsAverage: average(perDay.map((row) => row.steps)),
    restingHrAverage: average(perDay.map((row) => row.restingHr)),
    activities,
    total: { count: inView.length, seconds: activities.reduce((sum, group) => sum + group.seconds, 0) },
  }
}

// When garmin-sync last stored something (the newest fetched_at), or null.
export const lastFetched = (dayRows) => dayRows.reduce((newest, row) => (!newest || row.fetched_at > newest ? row.fetched_at : newest), null)

// Has garmin-sync not stored anything for STALE_AFTER_DAYS?
export const isStale = (fetchedAt, now = new Date()) => !!fetchedAt && now - new Date(fetchedAt) > STALE_AFTER_DAYS * 86400000

// Whole numbers grouped the Swiss way: 8866 → "8’866" (by hand, as for IBKR).
export const formatCount = (value) => (value === null || value === undefined ? '–' : String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '’'))

// Steps in thousands for the month's small cells: 9412 → "9.4".
export const formatThousands = (value) => (value === null || value === undefined ? '–' : (value / 1000).toFixed(1))

// 7680 seconds → "2:08 h".
export function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`
}

// The folded header: "Ø 8’866 steps · Ø 52 bpm" (owner G3).
export function headerSummary({ stepsAverage, restingHrAverage }) {
  const parts = []
  if (stepsAverage !== null) parts.push(`Ø ${formatCount(stepsAverage)} steps`)
  if (restingHrAverage !== null) parts.push(`Ø ${restingHrAverage} bpm`)
  return parts.join(' · ')
}

// The day under a number: "today" or the weekday ("Thu").
export const dayName = (day, today) => (day === today ? 'today' : formatWeekday(day))

// "October · 1 – 28 Oct"
export function monthLabel(days) {
  return `${formatMonth(days[0])} · ${Number(days[0].slice(8))} – ${formatShortDate(days.at(-1))}`
}

// Blank cells before the 1st in a Monday-first month grid.
export const leadingBlanks = (days) => weekdayIndex(days[0])

// "today 5:07 PM", "Tue 8:42 AM" or "24 Oct 8:42 AM" for the footer (owner, 28 Oct).
export function fetchedLabel(fetchedAt, today) {
  const at = new Date(fetchedAt)
  const time = formatTime12(at)
  const day = toDateKey(at)
  if (day === today) return `today ${time}`
  if (day >= addDays(today, -6)) return `${formatWeekday(day)} ${time}`
  return `${formatShortDate(day)} ${time}`
}

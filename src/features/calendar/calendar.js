import { addDays, formatShortDate, formatWeekday, toDateKey, toTimeKey } from '../../shared/utils/date.js'
import { safeCalendarUrl } from '../../../supabase/functions/_shared/calendarSync.js'

// Calendars on Dawn (v3.9): plain helpers, no React.

// The colours a calendar can have (Settings → Calendars).
export const CALENDAR_COLORS = [
  ['teal', 'Teal'],
  ['amber', 'Amber'],
  ['green', 'Green'],
  ['violet', 'Violet'],
  ['coral', 'Coral'],
  ['gold', 'Gold'],
  ['sky', 'Sky'],
  ['rose', 'Rose'],
]

export const AGENDA_DAYS = 7

// The address to save, or null – the same check the server does before it
// fetches anything (https or webcal, a real host name).
export const calendarAddress = (input) => safeCalendarUrl(input)

// "Today · Wed 18 Nov", "Tomorrow · Thu 19 Nov", "Fri 20 Nov"
export function dayHeading(day, today) {
  const date = `${formatWeekday(day)} ${formatShortDate(day)}`
  if (day === today) return `Today · ${date}`
  if (day === addDays(today, 1)) return `Tomorrow · ${date}`
  return date
}

// Today and the next 6 days, each with its events in order (all-day first):
// [{ day, events: [{ id, title, location, allDay, time, end, color, calendar }] }].
// All-day events show on every day they cover; timed events on the day they
// start, in this device's time zone. Events of switched-off calendars are left out.
export function agenda(events, sources, today, days = AGENDA_DAYS) {
  const byId = new Map(sources.filter((source) => source.enabled).map((source) => [source.id, source]))
  const result = Array.from({ length: days }, (_, index) => ({ day: addDays(today, index), events: [] }))
  const slot = new Map(result.map((entry) => [entry.day, entry.events]))
  for (const event of events) {
    const source = byId.get(event.source_id)
    if (!source) continue
    const base = { id: event.id, title: event.title, location: event.location, color: source.color, calendar: source.name }
    if (event.all_day) {
      for (const entry of result) if (event.start_day <= entry.day && entry.day < event.end_day) entry.events.push({ ...base, allDay: true, sort: '' })
    } else {
      const start = new Date(event.starts_at)
      const list = slot.get(toDateKey(start))
      if (list) list.push({ ...base, allDay: false, time: toTimeKey(start), end: toTimeKey(new Date(event.ends_at)), sort: event.starts_at })
    }
  }
  for (const entry of result) entry.events.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : a.title.localeCompare(b.title)))
  return result
}

// The newest read of all calendars (for "read 08:15").
export function lastRead(sources) {
  const times = sources.map((source) => source.last_sync_at).filter(Boolean).sort()
  return times.at(-1) ?? null
}

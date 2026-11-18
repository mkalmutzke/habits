// Calendars (v3.9): reading an iCal file (.ics) – Google, iCloud and Outlook
// all offer one per calendar – into the events of a time window. Plain
// JavaScript without Deno or packages, so it can be unit-tested.
//
// Covered: folded lines, escaped text, all-day and timed events, times in
// UTC, in a named time zone (TZID, also common Windows names from Outlook)
// or "floating" (the calendar's own zone), DTEND or DURATION, repeating
// events (RRULE: DAILY, WEEKLY with BYDAY, MONTHLY with BYMONTHDAY or BYDAY
// like 2MO / -1FR, YEARLY; INTERVAL, COUNT, UNTIL), EXDATE, moved or
// changed single dates (RECURRENCE-ID) and cancelled events. Repeats are
// counted on the wall clock of the event's own zone, so 09:00 stays 09:00
// across summer and winter time.

const MAX_STEPS = 5000
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const DAY_MS = 86_400_000

// Outlook writes Windows names for time zones; the most common ones.
const WINDOWS_ZONES = {
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'GMT Standard Time': 'Europe/London',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'UTC': 'UTC',
}

// A time zone the platform knows, or null.
export function knownZone(name) {
  if (!name) return null
  const candidate = WINDOWS_ZONES[name] ?? name.replace(/^\/+/, '')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate })
    return candidate
  } catch {
    return null
  }
}

// How far `zone` is ahead of UTC at the moment `ms`, in milliseconds.
function zoneOffset(ms, zone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

// The UTC moment of a wall-clock time in `zone`.
export function zonedToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, zone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second)
  if (!zone || zone === 'UTC') return wall
  let guess = wall - zoneOffset(wall, zone)
  guess = wall - zoneOffset(guess, zone)
  return guess
}

// The calendar day ('YYYY-MM-DD') of a UTC moment in `zone`.
export function dayIn(ms, zone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
}

const pad = (n) => String(n).padStart(2, '0')
const keyOf = ({ year, month, day }) => `${year}-${pad(month)}-${pad(day)}`
function addDaysTo(date, days) {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}
const weekdayOf = (date) => new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()

// ---------- reading the file ----------

// Lines of the file with folded continuation lines joined.
export function unfold(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n').filter((line) => line.length > 0)
}

// One line → { name, params, value }.
export function parseLine(line) {
  let quoted = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted
    else if (line[i] === ':' && !quoted) {
      colon = i
      break
    }
  }
  if (colon < 0) return null
  const [name, ...rawParams] = line.slice(0, colon).split(';')
  const params = {}
  for (const param of rawParams) {
    const eq = param.indexOf('=')
    if (eq > 0) params[param.slice(0, eq).toUpperCase()] = param.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) }
}

const unescapeText = (value) => value.replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1').trim()

// A DATE or DATE-TIME property → { allDay, date: {year,month,day}, time?, zone? }.
export function parseDateValue(prop, calendarZone) {
  if (!prop) return null
  const value = prop.value.trim()
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value)
  if (!m) return null
  const date = { year: +m[1], month: +m[2], day: +m[3] }
  if (prop.params.VALUE === 'DATE' || m[4] === undefined) return { allDay: true, date }
  const time = { hour: +m[4], minute: +m[5], second: +(m[6] ?? 0) }
  const zone = m[7] ? 'UTC' : knownZone(prop.params.TZID) ?? calendarZone ?? 'UTC'
  return { allDay: false, date, time, zone }
}

// An ISO duration (P1D, PT1H30M, -PT15M, P2W) in milliseconds.
export function parseDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(value).trim())
  if (!m) return null
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 24 * 3600 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000
  return m[1] === '-' ? -ms : ms
}

export function parseRule(value) {
  const rule = {}
  for (const part of String(value).split(';')) {
    const [key, val] = part.split('=')
    if (key && val !== undefined) rule[key.toUpperCase()] = val
  }
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.FREQ)) return null
  return {
    freq: rule.FREQ,
    interval: Math.max(1, parseInt(rule.INTERVAL ?? '1', 10) || 1),
    count: rule.COUNT ? parseInt(rule.COUNT, 10) : null,
    until: rule.UNTIL ?? null,
    byDay: rule.BYDAY ? rule.BYDAY.split(',').map((d) => { const x = /^([+-]?\d+)?([A-Z]{2})$/.exec(d.trim()); return x ? { n: x[1] ? +x[1] : 0, day: WEEKDAYS.indexOf(x[2]) } : null }).filter((d) => d && d.day >= 0) : [],
    byMonthDay: rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number).filter((n) => n && Math.abs(n) <= 31) : [],
  }
}

// The VEVENTs of a calendar file, as plain objects. Throws if it isn't one.
export function parseCalendar(text) {
  const lines = unfold(text)
  if (!lines.some((line) => line.toUpperCase() === 'BEGIN:VCALENDAR')) throw new Error('not an iCal file')
  let calendarZone = null
  const events = []
  let current = null
  let depth = 0
  for (const line of lines) {
    const prop = parseLine(line)
    if (!prop) continue
    if (prop.name === 'X-WR-TIMEZONE' && !current) calendarZone = knownZone(prop.value.trim())
    if (prop.name === 'BEGIN') {
      if (prop.value.toUpperCase() === 'VEVENT' && !current) current = { exdates: [], props: {} }
      else if (current) depth++
      continue
    }
    if (prop.name === 'END') {
      if (current && depth > 0) depth--
      else if (current && prop.value.toUpperCase() === 'VEVENT') {
        events.push(current)
        current = null
      }
      continue
    }
    if (!current || depth > 0) continue
    if (prop.name === 'EXDATE') current.exdates.push(...prop.value.split(',').map((value) => ({ ...prop, value })))
    else current.props[prop.name] = prop
  }
  return events.map((event) => ({
    uid: event.props.UID?.value.trim() ?? '',
    title: unescapeText(event.props.SUMMARY?.value ?? '') || '(no title)',
    location: unescapeText(event.props.LOCATION?.value ?? ''),
    link: (event.props.URL?.value ?? '').trim(),
    status: (event.props.STATUS?.value ?? '').trim().toUpperCase(),
    start: parseDateValue(event.props.DTSTART, calendarZone),
    end: parseDateValue(event.props.DTEND, calendarZone),
    duration: event.props.DURATION ? parseDuration(event.props.DURATION.value) : null,
    rule: event.props.RRULE ? parseRule(event.props.RRULE.value) : null,
    exdates: event.exdates.map((prop) => parseDateValue(prop, calendarZone)).filter(Boolean),
    recurrenceId: parseDateValue(event.props['RECURRENCE-ID'], calendarZone),
  }))
}

// ---------- repeats ----------

const momentOf = (value) => (value.allDay ? null : zonedToUtc({ ...value.date, ...value.time }, value.zone))
const occurrenceKey = (value) => (value.allDay ? keyOf(value.date) : String(momentOf(value)))

// UNTIL → a test for a candidate start date (+ time).
function untilTest(until, start) {
  if (!until) return () => true
  const parsed = parseDateValue({ value: until, params: {} }, start.zone)
  if (!parsed) return () => true
  if (parsed.allDay || start.allDay) return (date) => keyOf(date) <= keyOf(parsed.date)
  const limit = momentOf(parsed)
  return (date) => zonedToUtc({ ...date, ...start.time }, start.zone) <= limit
}

// The start dates of a repeating event, in order, from its first date.
function* repeatDates(start, rule) {
  const first = start.date
  const days = rule.byDay
  if (rule.freq === 'DAILY') {
    for (let i = 0; ; i += rule.interval) yield addDaysTo(first, i)
  } else if (rule.freq === 'WEEKLY') {
    const wanted = days.length ? days.map((d) => d.day) : [weekdayOf(first)]
    const monday = addDaysTo(first, -((weekdayOf(first) + 6) % 7))
    for (let week = 0; ; week += rule.interval) {
      for (let offset = 0; offset < 7; offset++) {
        const date = addDaysTo(monday, week * 7 + offset)
        if (wanted.includes(weekdayOf(date)) && keyOf(date) >= keyOf(first)) yield date
      }
    }
  } else if (rule.freq === 'MONTHLY') {
    for (let m = 0; ; m += rule.interval) {
      const total = first.month - 1 + m
      const year = first.year + Math.floor(total / 12)
      const month = (total % 12) + 1
      const last = daysInMonth(year, month)
      let dates = []
      if (days.length) {
        for (const { n, day } of days) {
          const all = []
          for (let d = 1; d <= last; d++) if (weekdayOf({ year, month, day: d }) === day) all.push(d)
          if (n === 0) dates.push(...all)
          else if (n > 0 && all[n - 1]) dates.push(all[n - 1])
          else if (n < 0 && all[all.length + n]) dates.push(all[all.length + n])
        }
      } else {
        dates = (rule.byMonthDay.length ? rule.byMonthDay : [first.day]).map((d) => (d < 0 ? last + d + 1 : d)).filter((d) => d >= 1 && d <= last)
      }
      for (const day of [...new Set(dates)].sort((a, b) => a - b)) {
        const date = { year, month, day }
        if (keyOf(date) >= keyOf(first)) yield date
      }
    }
  } else {
    for (let y = 0; ; y += rule.interval) {
      const year = first.year + y
      if (first.day <= daysInMonth(year, first.month)) yield { year, month: first.month, day: first.day }
    }
  }
}

// ---------- the window ----------

// The events of a calendar file that fall into [fromMs, toMs): one entry per
// occurrence, { uid, title, location, link, allDay, startsAt, endsAt (ISO) |
// startDay, endDay ('YYYY-MM-DD', end exclusive) }. `zone` is the owner's
// time zone, for all-day events. At most `limit` entries, earliest first.
export function eventsInWindow(text, { fromMs, toMs, zone = 'UTC', limit = 500 }) {
  const all = parseCalendar(text)
  const events = all.filter((event) => event.start && event.status !== 'CANCELLED')
  const fromDay = dayIn(fromMs, zone)
  const toDay = dayIn(toMs - 1, zone)
  // single dates of a repeating event that were moved, changed or cancelled
  const overrides = new Set(all.filter((event) => event.recurrenceId).map((event) => `${event.uid}|${occurrenceKey(event.recurrenceId)}`))
  const out = []

  function emit(event, date) {
    const base = { uid: event.uid, title: event.title.slice(0, 300), location: event.location.slice(0, 300), link: /^https?:\/\//i.test(event.link) ? event.link.slice(0, 1000) : '' }
    if (event.start.allDay) {
      const length = event.end?.allDay ? Math.max(1, Math.round((Date.UTC(event.end.date.year, event.end.date.month - 1, event.end.date.day) - Date.UTC(event.start.date.year, event.start.date.month - 1, event.start.date.day)) / DAY_MS)) : 1
      const startDay = keyOf(date)
      const endDay = keyOf(addDaysTo(date, length))
      if (startDay <= toDay && endDay > fromDay) out.push({ ...base, allDay: true, startDay, endDay })
      return
    }
    const startMs = zonedToUtc({ ...date, ...event.start.time }, event.start.zone)
    const firstStart = momentOf(event.start)
    const length = event.end && !event.end.allDay ? momentOf(event.end) - firstStart : event.duration ?? 0
    const endMs = startMs + Math.max(0, length)
    if (startMs < toMs && (endMs > fromMs || startMs >= fromMs)) out.push({ ...base, allDay: false, startsAt: new Date(startMs).toISOString(), endsAt: new Date(endMs).toISOString() })
  }

  for (const event of events) {
    if (!event.rule || event.recurrenceId) {
      emit(event, event.start.date)
      continue
    }
    const excluded = new Set(event.exdates.map(occurrenceKey))
    const withinUntil = untilTest(event.rule.until, event.start)
    let count = 0
    let steps = 0
    for (const date of repeatDates(event.start, event.rule)) {
      if (++steps > MAX_STEPS) break
      if (!withinUntil(date)) break
      count++
      if (event.rule.count && count > event.rule.count) break
      if (keyOf(date) > toDay) break
      const value = { ...event.start, date }
      const key = occurrenceKey(value)
      if (excluded.has(key) || overrides.has(`${event.uid}|${key}`)) continue
      // skip dates far before the window cheaply (the longest event we keep is 60 days)
      if (keyOf(addDaysTo(date, 60)) < fromDay) continue
      emit(event, date)
    }
  }
  const sortKey = (e) => (e.allDay ? `${e.startDay}T00` : e.startsAt)
  return out.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0)).slice(0, limit)
}

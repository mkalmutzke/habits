// Reading Garmin Connect Personal API answers (v3.5). Plain functions,
// no packages, so the same code runs in the Edge Function and in the
// unit tests. Garmin's field names are not published outside its browser-only
// reference, so each value is looked up under the names Garmin Connect uses,
// and fieldNames() reports what really arrived (names only, never values).

// The first list in an answer: Garmin returns either a list or an object
// holding one (daily summaries: { data: [...] }).
export function listOf(answer) {
  if (Array.isArray(answer)) return answer
  if (answer && typeof answer === 'object') {
    for (const key of ['data', 'dailySummaries', 'summaries', 'activities', 'activityList']) {
      if (Array.isArray(answer[key])) return answer[key]
    }
    const first = Object.values(answer).find(Array.isArray)
    if (first) return first
  }
  return []
}

// The first of several names that has a value; "heartRate.restingValue"
// reads inside a group.
const pick = (row, names) => {
  for (const name of names) {
    const value = name.split('.').reduce((inner, part) => inner?.[part], row)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

const integer = (value) => {
  const n = Number(value)
  return value === null || typeof value === 'object' || Number.isNaN(n) ? null : Math.round(n)
}

const decimal = (value) => {
  const n = Number(value)
  return value === null || Number.isNaN(n) ? null : n
}

const dateKey = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null)

// "2026-10-26 07:12:33" (Garmin's GMT) → "2026-10-26T07:12:33Z"
const gmtTimestamp = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value) ? `${value.replace(' ', 'T').replace(/Z$/, '')}Z` : null

// One row per calendar day: { day, steps, step_goal, resting_hr }.
export function parseDays(answer) {
  return listOf(answer)
    .map((row) => ({
      day: dateKey(pick(row, ['calendarDate', 'summaryDate', 'date'])),
      // Personal API (seen 28 Oct 2026): movement.steps.value / .goal, heartRate.restingValue
      steps: integer(pick(row, ['movement.steps.value', 'totalSteps', 'steps'])),
      step_goal: integer(pick(row, ['movement.steps.goal', 'dailyStepGoal', 'stepGoal', 'stepsGoal'])),
      resting_hr: integer(pick(row, ['heartRate.restingValue', 'restingHeartRate', 'restingHeartRateInBeatsPerMinute'])),
    }))
    .filter((row) => row.day)
}

const typeKey = (row) => {
  const type = row?.activityType
  const key = typeof type === 'string' ? type : (type?.typeKey ?? row?.activityTypeKey ?? null)
  return key ? String(key).toLowerCase() : 'other'
}

// One row per activity: { garmin_id, day, started_at, activity_type, name, distance_m, duration_s, moving_s }.
export function parseActivities(answer) {
  return listOf(answer)
    .map((row) => ({
      garmin_id: integer(pick(row, ['activityId', 'summaryId', 'id'])),
      day: dateKey(pick(row, ['startTimeLocal', 'startDateLocal', 'calendarDate'])),
      started_at: gmtTimestamp(pick(row, ['startTimeGMT', 'startTimeGmt'])),
      activity_type: typeKey(row),
      name: pick(row, ['activityName', 'name']),
      distance_m: decimal(pick(row, ['distance', 'distanceInMeters'])),
      duration_s: decimal(pick(row, ['duration', 'durationInSeconds', 'elapsedDuration'])),
      moving_s: decimal(pick(row, ['movingDuration', 'movingDurationInSeconds'])),
    }))
    .filter((row) => row.garmin_id !== null && row.day)
}

// The field names of the first row, up to three levels deep
// ("movement.steps.value") – to check Garmin's real names without ever
// logging a value.
const namesIn = (value, prefix, depth) =>
  value && typeof value === 'object' && !Array.isArray(value) && depth > 0
    ? Object.entries(value).flatMap(([key, inner]) => {
        const name = prefix ? `${prefix}.${key}` : key
        return [name, ...namesIn(inner, name, depth - 1)]
      })
    : []

export const fieldNames = (answer) => namesIn(listOf(answer)[0] ?? {}, '', 3).sort()

// "2026-10-28" ± n days (UTC calendar arithmetic on date keys).
export function shiftDay(key, days) {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// What one run fetches: from the earlier of "1st of this month" and
// "today − 6 days" (both views of the card), up to today. With nothing stored
// yet (or when asked for a full run), the whole last year (owner G7: 365 days).
export function fetchRange(todayKey, newestStored, full = false) {
  const monthStart = `${todayKey.slice(0, 8)}01`
  const weekStart = shiftDay(todayKey, -6)
  const from = newestStored && !full ? (monthStart < weekStart ? monthStart : weekStart) : shiftDay(todayKey, -365)
  return { from, to: todayKey }
}

// Splits a range into pieces of at most `size` days, oldest first.
export function chunks({ from, to }, size) {
  const pieces = []
  for (let start = from; start <= to; start = shiftDay(start, size)) {
    const end = shiftDay(start, size - 1)
    pieces.push({ from: start, to: end < to ? end : to })
  }
  return pieces
}

// The calendar date in a time zone ("Europe/Zurich" → "2026-10-28").
export function todayIn(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type) => parts.find((part) => part.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

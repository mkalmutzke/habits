// Timing rules for reminders, shared by the Edge Functions (Deno) and tested
// with Vitest (supabase/functions/_shared/schedule.test.js). Plain JavaScript,
// no imports, so both runtimes can use it.

export const MAX_ATTEMPTS = 3
export const RETRY_MINUTES = 5

// Wall-clock parts of `date` in a time zone (e.g. 'Europe/Zurich').
export function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => Number(parts.find((part) => part.type === type).value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

// Unknown or empty time zones fall back to UTC instead of crashing.
export function safeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone })
    return timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// The exact moment a wall-clock time happens in a time zone.
export function zonedTimeToDate({ year, month, day, hour, minute }, timeZone) {
  // start with the time as if it were UTC, then correct by the zone's offset
  let guess = Date.UTC(year, month - 1, day, hour, minute)
  for (let i = 0; i < 2; i++) {
    const seen = zonedParts(new Date(guess), timeZone)
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute)
    guess += Date.UTC(year, month - 1, day, hour, minute) - seenAsUtc
  }
  return new Date(guess)
}

const minutesOf = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number)
  return hours * 60 + minutes
}

// If `now` falls into the quiet hours, the moment they end; otherwise null.
// Quiet hours may span midnight (e.g. 22:00–07:00).
export function quietUntil(now, timeZone, quietStart, quietEnd) {
  if (!quietStart || !quietEnd) return null
  const start = minutesOf(quietStart)
  const end = minutesOf(quietEnd)
  if (start === end) return null
  const local = zonedParts(now, timeZone)
  const current = local.hour * 60 + local.minute
  const overMidnight = start > end
  const inQuiet = overMidnight ? current >= start || current < end : current >= start && current < end
  if (!inQuiet) return null
  // the end is tomorrow if we're in the evening part of an over-midnight range
  const endDay = overMidnight && current >= start ? addOneDay(local) : local
  return zonedTimeToDate({ ...endDay, hour: Math.floor(end / 60), minute: end % 60 }, timeZone)
}

function addOneDay({ year, month, day }) {
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

// What happens to a reminder after one sending attempt.
//   results: { push?: 'sent'|'failed'|'skipped', email?: …, inapp?: … }
// Sent as soon as one channel worked (or there was nothing the server must
// send, e.g. only in-app); otherwise retried up to MAX_ATTEMPTS times.
export function outcome(results, attempts, now) {
  const values = Object.values(results)
  if (values.includes('sent') || values.every((value) => value === 'skipped')) {
    return { status: 'sent' }
  }
  if (attempts >= MAX_ATTEMPTS) return { status: 'failed' }
  return { status: 'pending', retryAt: new Date(now.getTime() + RETRY_MINUTES * attempts * 60_000) }
}

// "Call the dentist" + "14:00" in the user's time zone, for push and email.
export function formatTime(date, timeZone) {
  const { hour, minute } = zonedParts(date, timeZone)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

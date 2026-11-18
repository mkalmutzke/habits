// calendar-sync (v3.9): plain helpers, no Deno or network code, so they can
// be unit-tested. The addresses come from users, so before anything is
// fetched they are checked: https only, a real host name – no IP addresses,
// no "localhost" or internal names – so the server can't be pointed at
// itself or a private network.

import { zonedToUtc } from './ical.js'

export const MAX_BYTES = 3 * 1024 * 1024
export const WINDOW_DAYS_BEFORE = 1
export const WINDOW_DAYS_AFTER = 15

// The address to fetch, or null. "webcal://" (iCloud, Outlook) means https.
export function safeCalendarUrl(address) {
  if (typeof address !== 'string') return null
  const raw = address.trim().replace(/^webcals?:\/\//i, 'https://')
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host === 'localhost' || host.endsWith('.localhost')) return null
  // IPv4 / IPv6 literals
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[') || host.includes(':')) return null
  if (url.port && url.port !== '443') return null
  return url.href
}

// The window kept for a user: yesterday 00:00 to 15 days ahead, their time zone.
export function windowFor(today, zone) {
  const [year, month, day] = today.split('-').map(Number)
  return {
    fromMs: zonedToUtc({ year, month, day: day - WINDOW_DAYS_BEFORE }, zone),
    toMs: zonedToUtc({ year, month, day: day + WINDOW_DAYS_AFTER }, zone),
    zone,
  }
}

// The rows store_calendar_events takes.
export function toRows(events) {
  return events.map((event) =>
    event.allDay
      ? { uid: event.uid, all_day: true, start_day: event.startDay, end_day: event.endDay, title: event.title, location: event.location, link: event.link }
      : { uid: event.uid, all_day: false, starts_at: event.startsAt, ends_at: event.endsAt, title: event.title, location: event.location, link: event.link },
  )
}

// What the user reads in Settings when a calendar couldn't be read.
export function syncErrorText(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/^HTTP (401|403)/.test(message)) return 'The calendar refused access – the address may have been reset. Paste the new one.'
  if (/^HTTP 404/.test(message)) return 'No calendar at this address – check it, or paste the new one.'
  if (/^HTTP \d+/.test(message)) return `The calendar's server answered with an error (${message}). It is tried again in 15 minutes.`
  if (/not an iCal file/.test(message)) return 'The address doesn’t give an iCal calendar – use the “secret address in iCal format”.'
  if (/too large/.test(message)) return 'The calendar is too large to read (over 3 MB).'
  if (/timed out|abort/i.test(message)) return 'The calendar didn’t answer in time. It is tried again in 15 minutes.'
  return 'The calendar couldn’t be read. It is tried again in 15 minutes.'
}

// calendar-sync (v3.9): reads the users' calendars (secret iCal addresses)
// and stores the events from yesterday to two weeks ahead with
// store_calendar_events. Called by the database scheduler every 15 minutes
// (all users), or by the app's Refresh button on Dawn (the signed-in user's
// calendars only, at most once a minute). Addresses are checked before every
// request and after every redirect (_shared/calendarSync.js). Logs only
// counts and short reasons – never an address or an event.
import { db, userFromToken } from '../_shared/admin.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { MAX_BYTES, safeCalendarUrl, syncErrorText, toRows, windowFor } from '../_shared/calendarSync.js'
import { todayIn } from '../_shared/garmin.js'
import { eventsInWindow } from '../_shared/ical.js'

const REFRESH_PAUSE_MS = 60 * 1000
const MAX_CALENDARS_PER_RUN = 40
const TIMEOUT_MS = 15_000

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// The scheduler (its token is in the database's Vault) or a signed-in user.
async function caller(token: string): Promise<{ kind: 'scheduler' } | { kind: 'app'; userId: string } | null> {
  if (!token) return null
  try {
    if ((await db.rpc('check_cron_token', { token })) === true) return { kind: 'scheduler' }
  } catch {
    // not the scheduler's token
  }
  const user = await userFromToken(token).catch(() => null)
  return user ? { kind: 'app', userId: user.id } : null
}

// The calendar file: https only, at most 3 redirects (each checked), 3 MB, 15 s.
async function fetchCalendar(address: string): Promise<string> {
  let url = safeCalendarUrl(address)
  for (let hop = 0; hop < 4; hop++) {
    if (!url) throw new Error('address not allowed')
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5', 'User-Agent': 'habits-app/3.9 (calendar-sync)' },
    })
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location')
      await response.body?.cancel()
      url = next ? safeCalendarUrl(new URL(next, url).href) : null
      continue
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_BYTES) throw new Error('too large')
    const text = await response.text()
    if (text.length > MAX_BYTES) throw new Error('too large')
    return text
  }
  throw new Error('too many redirects')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const who = await caller((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''))
  if (!who) return json({ error: 'Unauthorized' }, 401)

  try {
    const jobs = (await db.rpc('calendar_jobs', { only_user: who.kind === 'app' ? who.userId : null })) as {
      source_id: string
      address: string
      time_zone: string
      last_sync_at: string | null
    }[]
    // the pause doesn't hold back a calendar that was never read (just added)
    if (who.kind === 'app' && jobs.every((job) => job.last_sync_at)) {
      const latest = Math.max(0, ...jobs.map((job) => (job.last_sync_at ? Date.parse(job.last_sync_at) : 0)))
      if (Date.now() - latest < REFRESH_PAUSE_MS) return json({ error: 'Updated less than a minute ago – try again in a moment.' }, 429)
    }
    let stored = 0
    let failed = 0
    for (const job of jobs.slice(0, MAX_CALENDARS_PER_RUN)) {
      try {
        const zone = job.time_zone || 'UTC'
        const events = eventsInWindow(await fetchCalendar(job.address), windowFor(todayIn(zone), zone))
        stored += await db.rpc('store_calendar_events', { source: job.source_id, events: toRows(events), sync_error: null })
      } catch (error) {
        failed++
        console.error(`calendar-sync: one calendar failed: ${error instanceof Error ? error.message.slice(0, 80) : 'error'}`)
        await db.rpc('store_calendar_events', { source: job.source_id, events: null, sync_error: syncErrorText(error) }).catch(() => {})
      }
    }
    console.log(`calendar-sync: ${jobs.length} calendars, ${stored} events, ${failed} failed`)
    return json({ calendars: jobs.length, events: stored, failed })
  } catch (error) {
    console.error(`calendar-sync: ${error instanceof Error ? error.message.slice(0, 120) : 'failed'}`)
    return json({ error: 'Could not read the calendars – see the function log.' }, 500)
  }
})

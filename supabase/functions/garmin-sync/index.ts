// garmin-sync (v3.5): called by the database scheduler (pg_cron) every
// 30 minutes. Reads the owner's Garmin daily summaries and activities for the
// current month and the last 7 days – the whole last year on the first run, or
// when the body says { "full": true } – and stores them with store_garmin_data.
// Logs only dates, counts and field names, never figures.
// v3.6: the app's Refresh button (Garmin window) may call it too, with the
// signed-in owner's token – at most once per 2 minutes (counted from the last
// stored data, whoever fetched it), to stay well inside Garmin's limits.
import { db, userFromToken } from '../_shared/admin.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { chunks, fetchRange, fieldNames, listOf, parseActivities, parseDays, todayIn } from '../_shared/garmin.js'
import { activities, dailySummaries, obtainToken } from '../_shared/garminClient.ts'

// days per request – small enough for any limit Garmin may have
const CHUNK_DAYS = 31
// v3.6: the app's Refresh button – at most once per this many milliseconds
const REFRESH_PAUSE_MS = 2 * 60 * 1000

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Who is calling: the scheduler (its token lives in the database's Vault) or
// the signed-in app (v3.6) – or nobody allowed.
async function caller(token: string): Promise<'scheduler' | 'app' | null> {
  if (!token) return null
  try {
    if ((await db.rpc('check_cron_token', { token })) === true) return 'scheduler'
  } catch {
    // not the scheduler's token
  }
  return (await userFromToken(token).catch(() => null)) ? 'app' : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const who = await caller((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''))
  if (!who) return json({ error: 'Unauthorized' }, 401)

  // Entered by the owner in the Supabase dashboard.
  const apiKey = Deno.env.get('GARMIN_API_KEY')
  if (!apiKey) return json({ skipped: 'not set up' })

  try {
    // "today" is the owner's calendar day (the time zone reminders use too)
    const [settings] = await db.select('user_settings', 'select=time_zone&limit=1')
    const today = todayIn(settings?.time_zone || 'UTC')
    const [newest] = await db.select('garmin_days', 'select=day&order=day.desc&limit=1')
    if (who === 'app') {
      const [latest] = await db.select('garmin_days', 'select=fetched_at&order=fetched_at.desc&limit=1')
      if (latest && Date.now() - new Date(latest.fetched_at).getTime() < REFRESH_PAUSE_MS) {
        return json({ error: 'Updated less than 2 minutes ago – try again in a moment.' }, 429)
      }
    }
    // { "full": true } in the body fetches the whole last year again (after a reader fix)
    const body = await req.json().catch(() => ({}))
    // only the scheduler (or the owner by hand with its token) may ask for a whole year
    const range = fetchRange(today, newest?.day ?? null, who === 'scheduler' && body?.full === true)

    const token = await obtainToken(apiKey)
    const dayAnswers: unknown[] = []
    const activityRows: unknown[] = []
    for (const piece of chunks(range, CHUNK_DAYS)) {
      dayAnswers.push(...listOf(await dailySummaries(token, piece.from, piece.to)))
      activityRows.push(...(await activities(token, piece.from, piece.to)))
    }
    const days = parseDays(dayAnswers)
    const acts = parseActivities(activityRows).filter((row) => row.day >= range.from && row.day <= range.to)

    const stored = await db.rpc('store_garmin_data', { period: range, days, activities: acts })
    const fields = { days: fieldNames(dayAnswers), activities: fieldNames(activityRows) }
    console.log(`garmin-sync: ${range.from} – ${range.to}: ${stored} days, ${acts.length} activities`)
    return json({ range, days: stored, activities: acts.length, received: { days: dayAnswers.length, activities: activityRows.length }, fields })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`garmin-sync: ${message}`)
    return json({ error: message }, 500)
  }
})

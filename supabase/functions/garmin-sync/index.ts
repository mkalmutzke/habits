// garmin-sync (v3.5): called by the database scheduler (pg_cron) every
// 30 minutes. Reads the owner's Garmin daily summaries and activities for the
// current month and the last 7 days – the whole last year on the first run, or
// when the body says { "full": true } – and stores them with store_garmin_data.
// Logs only dates, counts and field names, never figures.
import { db } from '../_shared/admin.ts'
import { chunks, fetchRange, fieldNames, listOf, parseActivities, parseDays, todayIn } from '../_shared/garmin.js'
import { activities, dailySummaries, obtainToken } from '../_shared/garminClient.ts'

// days per request – small enough for any limit Garmin may have
const CHUNK_DAYS = 31

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Only the scheduler knows the token (it lives in the database's Vault).
  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  let authOk = false
  try {
    authOk = auth.length > 0 && (await db.rpc('check_cron_token', { token: auth })) === true
  } catch {
    authOk = false
  }
  if (!authOk) return new Response('Unauthorized', { status: 401 })

  // Entered by the owner in the Supabase dashboard.
  const apiKey = Deno.env.get('GARMIN_API_KEY')
  if (!apiKey) return json({ skipped: 'not set up' })

  try {
    // "today" is the owner's calendar day (the time zone reminders use too)
    const [settings] = await db.select('user_settings', 'select=time_zone&limit=1')
    const today = todayIn(settings?.time_zone || 'UTC')
    const [newest] = await db.select('garmin_days', 'select=day&order=day.desc&limit=1')
    // { "full": true } in the body fetches the whole last year again (after a reader fix)
    const body = await req.json().catch(() => ({}))
    const range = fetchRange(today, newest?.day ?? null, body?.full === true)

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

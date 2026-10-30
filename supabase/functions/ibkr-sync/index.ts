// ibkr-sync (v3.4): called by the database scheduler (pg_cron) on
// Tuesday to Saturday mornings. Fetches the two IBKR Flex reports – the last
// business day and the year to date – and stores them as one snapshot with
// store_portfolio_snapshot. Logs only dates, counts and errors, never figures.
import { db } from '../_shared/admin.ts'
import { expectedTradingDay, parseDailyStatement, parsePerformanceStatement } from '../_shared/flex.js'
import { fetchStatement } from '../_shared/flexClient.ts'

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
  const flexToken = Deno.env.get('IBKR_FLEX_TOKEN')
  const dailyQuery = Deno.env.get('IBKR_FLEX_QUERY_DAILY')
  const performanceQuery = Deno.env.get('IBKR_FLEX_QUERY_PERF')
  if (!flexToken || !dailyQuery) return json({ skipped: 'not set up' })

  try {
    // The retry run has nothing to do once the expected trading day is stored.
    const expected = expectedTradingDay(new Date().toISOString().slice(0, 10))
    const [latest] = await db.select('portfolio_snapshots', 'select=as_of&order=as_of.desc&limit=1')
    if (latest && latest.as_of >= expected) return json({ skipped: `already stored ${latest.as_of}` })

    const { snapshot, positions } = parseDailyStatement(await fetchStatement(flexToken, dailyQuery))
    const performance = performanceQuery ? parsePerformanceStatement(await fetchStatement(flexToken, performanceQuery)) : {}
    await db.rpc('store_portfolio_snapshot', { snapshot: { ...snapshot, ...performance }, positions })
    console.log(`ibkr-sync: stored ${snapshot.as_of} with ${positions.length} positions`)
    return json({ stored: snapshot.as_of, positions: positions.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`ibkr-sync: ${message}`)
    return json({ error: message }, 500)
  }
})

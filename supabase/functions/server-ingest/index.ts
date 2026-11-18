// server-ingest (v3.8): the only way into server_reports. Called every 5
// minutes by the health agent on a user's server (scripts/server-agent),
// never by the app. The agent sends its own token as Bearer token; the
// database finds the server by the token's fingerprint (store_server_report).
// The body is the report as JSON (at most 8000 characters), checked and
// trimmed by _shared/serverReport.js. Answers:
//   200 { stored: true }   401 unknown token   429 sooner than 50 s after the last one
// Logs only the outcome – never the token or the figures.
import { db } from '../_shared/admin.ts'
import { isAgentToken, MAX_BODY, normalizeReport } from '../_shared/serverReport.js'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!isAgentToken(token)) return json({ error: 'Unauthorized' }, 401)

  const text = await req.text()
  if (text.length > MAX_BODY) return json({ error: 'Report too large' }, 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json({ error: 'The report must be JSON' }, 400)
  }
  const report = normalizeReport(body)
  if (!report) return json({ error: 'The report must be a JSON object' }, 400)

  try {
    const result = await db.rpc('store_server_report', { token, report })
    if (result === 'unknown') return json({ error: 'Unauthorized' }, 401)
    if (result === 'too soon') return json({ error: 'Too soon – at most one report per minute' }, 429)
    return json({ stored: true })
  } catch (error) {
    console.error(`server-ingest: ${error instanceof Error ? error.message.slice(0, 120) : 'failed'}`)
    return json({ error: 'Could not store the report' }, 500)
  }
})

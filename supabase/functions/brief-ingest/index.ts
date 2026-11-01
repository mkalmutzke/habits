// brief-ingest (v3.6): the only way into the briefs table. Called by the
// owner's Claude scheduled tasks (one per brief), never by the app.
// Two calls per run, each with the brief-ingest password as Bearer token
// (entered by the owner in the Supabase dashboard as BRIEF_INGEST_TOKEN and
// in the Claude cloud environment – never in code, chat or logs):
//   { "action": "start", "kind": "ibkr" | "jobs" | "world" }
//     → { run: false, reason } when the brief is switched off in Settings or
//       today is not one of its days – the task then stops at once;
//       otherwise { run: true, today, holdings?, holdings_as_of?, fallback? }.
//       The IBKR brief gets the holdings of the newest stored IBKR report –
//       symbol and name only – or VT and VWO with fallback: true.
//   { "action": "store", "kind": …, "brief": { … } }
//     → checks and trims the brief (_shared/brief.js) and stores it as the
//       owner's brief for today, replacing the previous one.
// Logs only the kind, the day and counts – never the content.
import { db } from '../_shared/admin.ts'
import { KINDS, holdingsForBrief, normalizeBrief, sameText, shouldRun } from '../_shared/brief.js'

const FALLBACK_HOLDINGS = [
  { symbol: 'VT', name: 'Vanguard Total World Stock ETF', asset_class: 'STK' },
  { symbol: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', asset_class: 'STK' },
]

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const expected = Deno.env.get('BRIEF_INGEST_TOKEN') ?? ''
  if (expected.length < 32) return json({ error: 'brief-ingest is not set up' }, 503)
  const given = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!sameText(given, expected)) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  const kind = body?.kind
  if (!KINDS.includes(kind)) return json({ error: 'kind must be ibkr, jobs or world' }, 400)

  try {
    const context = await db.rpc('brief_context', {})
    const settings = { brief_ibkr_on: context.on.ibkr, brief_jobs_on: context.on.jobs, brief_world_on: context.on.world }
    const run = shouldRun(kind, settings, context.today)
    const reason = settings[`brief_${kind}_on`] === false ? 'switched off in Settings' : 'not one of this brief’s days'

    if (body.action === 'start') {
      if (!run) return json({ run: false, reason, today: context.today })
      if (kind !== 'ibkr') return json({ run: true, today: context.today })
      const holdings = holdingsForBrief(context.holdings)
      return holdings.length
        ? json({ run: true, today: context.today, holdings, holdings_as_of: context.holdings_as_of })
        : json({ run: true, today: context.today, holdings: FALLBACK_HOLDINGS, fallback: true })
    }

    if (body.action === 'store') {
      if (!run) return json({ stored: false, reason })
      const { brief, error } = normalizeBrief(kind, body.brief)
      if (error) return json({ error }, 400)
      const day = await db.rpc('store_brief', { brief_kind: kind, content: brief })
      const items = brief.sections.reduce((sum: number, section: { items: unknown[] }) => sum + section.items.length, 0)
      console.log(`brief-ingest: stored ${kind} for ${day} (${brief.sections.length} sections, ${items} items)`)
      return json({ stored: true, day, sections: brief.sections.length, items })
    }

    return json({ error: 'action must be start or store' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`brief-ingest: ${kind}: ${message}`)
    return json({ error: 'could not handle the brief – see the function log' }, 500)
  }
})

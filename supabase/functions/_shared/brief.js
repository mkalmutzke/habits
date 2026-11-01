// The daily briefs (v3.6): pure helpers for brief-ingest, with no Deno or
// network code, so they can be unit-tested. A brief is written by a Claude
// scheduled task and sent to brief-ingest as JSON; everything it contains is
// checked and trimmed here before it is stored, because it comes from
// outside (web search results).

export const KINDS = ['ibkr', 'jobs', 'world']

// The setting that switches each brief on or off (user_settings).
export const SETTING_OF = { ibkr: 'brief_ibkr_on', jobs: 'brief_jobs_on', world: 'brief_world_on' }

// The days each brief runs on (0 = Sunday … 6 = Saturday, in the owner's
// time zone): IBKR Tuesday to Saturday (after a trading day), the others
// every day (owner).
export const RUN_DAYS = { ibkr: [2, 3, 4, 5, 6], jobs: [0, 1, 2, 3, 4, 5, 6], world: [0, 1, 2, 3, 4, 5, 6] }

// Limits – generous for a short list of headlines, small enough that a
// broken run can't store a novel.
const LIMITS = { sections: 6, items: 12, heading: 60, headline: 220, why: 220, source: 60, url: 1000, text: 600, ticker: 12, tickers: 30 }

// Text: a string, single spaces, at most `max` characters; anything else → ''.
export function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

// Only real web links (http/https) are kept – never javascript:, data: or the like.
export function cleanUrl(value) {
  if (typeof value !== 'string' || value.length > LIMITS.url) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

// The site's name for the link label when the brief gives none, e.g. "reuters.com".
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function cleanItem(item) {
  if (!item || typeof item !== 'object') return null
  const headline = cleanText(item.headline, LIMITS.headline)
  const url = cleanUrl(item.url)
  if (!headline || !url) return null
  const why = cleanText(item.why, LIMITS.why)
  return { headline, url, source: cleanText(item.source, LIMITS.source) || hostOf(url), ...(why ? { why } : {}) }
}

function cleanSection(section) {
  if (!section || typeof section !== 'object' || !Array.isArray(section.items)) return null
  const items = section.items.map(cleanItem).filter(Boolean).slice(0, LIMITS.items)
  if (items.length === 0) return null
  return { heading: cleanText(section.heading, LIMITS.heading) || 'News', items }
}

// What brief-ingest stores for one brief, or { error } when it can't be used.
// Input (all optional except at least one item, or quiet: true):
//   { intro, note, summary, tickers: ['VT'], quiet, sections: [{ heading, items: [{ headline, why, url, source }] }] }
export function normalizeBrief(kind, input) {
  if (!KINDS.includes(kind)) return { error: `unknown brief "${kind}"` }
  if (!input || typeof input !== 'object') return { error: 'the brief must be an object' }
  const sections = (Array.isArray(input.sections) ? input.sections : []).map(cleanSection).filter(Boolean).slice(0, LIMITS.sections)
  const quiet = input.quiet === true
  if (sections.length === 0 && !quiet) return { error: 'the brief has no usable headlines (each needs a headline and an http(s) link)' }
  const brief = { sections }
  const intro = cleanText(input.intro, LIMITS.text)
  const note = cleanText(input.note, LIMITS.text)
  const summary = cleanText(input.summary, LIMITS.text)
  if (intro) brief.intro = intro
  if (note) brief.note = note
  if (summary) brief.summary = summary
  if (quiet) brief.quiet = true
  if (Array.isArray(input.tickers)) {
    const tickers = input.tickers.map((ticker) => cleanText(ticker, LIMITS.ticker).toUpperCase()).filter((ticker) => /^[A-Z0-9.\-]+$/.test(ticker))
    if (tickers.length) brief.tickers = [...new Set(tickers)].slice(0, LIMITS.tickers)
  }
  return { brief }
}

// The weekday (0 = Sunday) of a 'YYYY-MM-DD' day.
export function weekdayOf(day) {
  return new Date(`${day}T12:00:00Z`).getUTCDay()
}

// Should this brief run today? Off in Settings, or not one of its days → no.
export function shouldRun(kind, settings, today) {
  if (!KINDS.includes(kind)) return false
  if (settings?.[SETTING_OF[kind]] === false) return false
  return RUN_DAYS[kind].includes(weekdayOf(today))
}

// The holdings the IBKR brief may see: symbol and name only – never
// quantities, values or any other account figure (owner). Cash is left out.
export function holdingsForBrief(positions) {
  const seen = new Set()
  const holdings = []
  for (const row of positions ?? []) {
    const symbol = cleanText(row?.symbol, LIMITS.ticker).toUpperCase()
    if (!symbol || seen.has(symbol) || String(row?.asset_class ?? '').toUpperCase() === 'CASH') continue
    seen.add(symbol)
    holdings.push({ symbol, name: cleanText(row?.description, 120), asset_class: cleanText(row?.asset_class, 20) })
  }
  return holdings
}

// Constant-time comparison of two strings (for the ingest token).
export function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const length = Math.max(a.length, b.length)
  let difference = a.length ^ b.length
  for (let index = 0; index < length; index++) difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0)
  return difference === 0
}

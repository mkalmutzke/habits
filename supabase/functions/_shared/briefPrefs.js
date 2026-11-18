// The settings of the daily briefs (v3.9, owner: "as configurable as
// possible from the app"). Plain JavaScript without Deno or React, used by
// both sides: the app (Settings → Daily briefs) and brief-ingest, which hands
// them to the morning run. Stored in user_settings.brief_prefs as
// { ibkr: {…}, jobs: {…}, world: {…} }; anything missing falls back to the
// defaults below, so an empty object means "as before v3.9".

export const BRIEF_KINDS = ['ibkr', 'jobs', 'world']

// The topics a brief can cover: [key, label]. The run gets the labels.
export const BRIEF_TOPICS = {
  ibkr: [
    ['macro', 'Central banks & macro data'],
    ['holdings', 'Top holdings & sectors'],
    ['earnings', 'Earnings'],
    ['currencies', 'Currencies'],
    ['trade', 'Trade policy'],
  ],
  jobs: [
    ['hiring', 'Hiring & layoffs'],
    ['economy', 'Economy & interest rates'],
    ['industry', 'News from my field'],
    ['contracting', 'Contracting & tax rules'],
    ['immigration', 'Work permits & moving'],
    ['remote', 'Remote work'],
  ],
  world: [
    ['politics', 'Politics'],
    ['economy', 'Economy'],
    ['conflicts', 'Conflicts & diplomacy'],
    ['science', 'Science & climate'],
    ['technology', 'Technology'],
    ['health', 'Health'],
    ['culture', 'Culture'],
    ['sport', 'Sport'],
  ],
}

// The lists a brief has: field → { label, placeholder, ticker (symbols only) }.
export const BRIEF_LISTS = {
  ibkr: { watchlist: { label: 'Also watch (symbols)', placeholder: 'e.g. NVDA', ticker: true } },
  jobs: {
    countries: { label: 'Countries', placeholder: 'e.g. Canada' },
    titles: { label: 'Job titles', placeholder: 'e.g. SAP Analytics Consultant' },
  },
  world: {
    regions: { label: 'Regions', placeholder: 'e.g. Europe' },
    avoid: { label: 'Leave out', placeholder: 'e.g. celebrity news' },
  },
}

// What each brief does without settings – the same as the v3.6 instructions.
export const DEFAULT_PREFS = {
  ibkr: { icon: true, title: '', watchlist: [], topics: ['macro', 'holdings', 'currencies', 'trade'], max: 7, extra: '' },
  jobs: {
    icon: true,
    title: '',
    countries: ['Canada'],
    titles: ['SAP Analytics Consultant', 'BI Architect'],
    topics: ['hiring', 'economy', 'industry', 'contracting', 'immigration', 'remote'],
    about: '',
    max: 8,
    extra: '',
  },
  world: { icon: true, title: '', regions: ['World'], topics: ['politics', 'economy', 'conflicts', 'science', 'technology'], avoid: [], max: 8, extra: '' },
}

export const LIMITS = { title: 40, entry: 60, entries: 10, about: 600, extra: 300, minItems: 3, maxItems: 15 }

const text = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '')

// A list entry: plain text (60 characters), or for symbols A–Z, 0–9, . and -.
export function cleanEntry(value, ticker = false) {
  const cleaned = text(value, ticker ? 12 : LIMITS.entry)
  if (!ticker) return cleaned
  const symbol = cleaned.toUpperCase()
  return /^[A-Z0-9.-]+$/.test(symbol) ? symbol : ''
}

function cleanList(value, ticker) {
  if (!Array.isArray(value)) return null
  const seen = new Set()
  const out = []
  for (const entry of value) {
    const cleaned = cleanEntry(entry, ticker)
    const key = cleaned.toLowerCase()
    if (cleaned && !seen.has(key)) {
      seen.add(key)
      out.push(cleaned)
    }
  }
  return out.slice(0, LIMITS.entries)
}

// One brief's settings, complete and safe: defaults for what is missing,
// unknown fields and topics dropped, texts trimmed, lists de-duplicated.
export function normalizePrefs(kind, raw) {
  const defaults = DEFAULT_PREFS[kind]
  if (!defaults) return null
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const prefs = { ...defaults }
  if (typeof input.icon === 'boolean') prefs.icon = input.icon
  if ('title' in input) prefs.title = text(input.title, LIMITS.title)
  if ('extra' in input) prefs.extra = text(input.extra, LIMITS.extra)
  if ('about' in defaults && 'about' in input) prefs.about = text(input.about, LIMITS.about)
  if (Number.isInteger(input.max)) prefs.max = Math.min(LIMITS.maxItems, Math.max(LIMITS.minItems, input.max))
  if (Array.isArray(input.topics)) {
    const known = BRIEF_TOPICS[kind].map(([key]) => key)
    prefs.topics = known.filter((key) => input.topics.includes(key))
  }
  for (const [field, { ticker }] of Object.entries(BRIEF_LISTS[kind])) {
    const list = cleanList(input[field], ticker)
    if (list) prefs[field] = list
  }
  return prefs
}

// What the morning run gets: the settings, with the topics as their labels.
export function prefsForRun(kind, raw) {
  const prefs = normalizePrefs(kind, raw)
  if (!prefs) return null
  const labels = Object.fromEntries(BRIEF_TOPICS[kind])
  const { icon: _icon, ...rest } = prefs
  return { ...rest, topics: prefs.topics.map((key) => labels[key]) }
}

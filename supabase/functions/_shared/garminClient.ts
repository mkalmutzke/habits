// Garmin Connect Personal API (v3.5): exchange the owner's personal
// key for an access token (valid 24 hours), then read with it. Plain HTTPS, no
// packages. The key and the token are never logged – errors name only
// the request path and Garmin's HTTP status.

const BASE = 'https://personal.connectapi.garmin.com'
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token'
const HEADERS = { 'User-Agent': 'habits-app/3.5 (garmin-sync)' }
// activities per page of the activity search
const PAGE = 100

const query = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()

// The access token: Garmin answers with the token itself as plain text.
export async function obtainToken(apiKey: string): Promise<string> {
  const response = await fetch(`${BASE}${TOKEN_PATH}`, {
    method: 'POST',
    headers: { ...HEADERS, Accept: '*/*', Authorization: `ApiKey ${apiKey}` },
  })
  const text = (await response.text()).trim()
  if (!response.ok) throw new Error(`Garmin token: HTTP ${response.status}`)
  if (!text) throw new Error('Garmin token: empty answer')
  return text
}

async function get(token: string, path: string, params: Record<string, string | number>): Promise<unknown> {
  const response = await fetch(`${BASE}${path}?${query(params)}`, {
    headers: { ...HEADERS, Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Garmin ${path}: HTTP ${response.status}`)
  return text ? JSON.parse(text) : null
}

// Daily summaries for an inclusive date range.
export const dailySummaries = (token: string, from: string, to: string) =>
  get(token, '/usersummary-service/v2/dailysummaries', { startDate: from, endDate: to })

// All activities in an inclusive date range, page by page.
export async function activities(token: string, from: string, to: string): Promise<unknown[]> {
  const all: unknown[] = []
  for (let start = 0; ; start += PAGE) {
    const answer = await get(token, '/activitylist-service/activities/search/activities', {
      startDate: from,
      endDate: to,
      start,
      limit: PAGE,
    })
    const page = Array.isArray(answer) ? answer : []
    all.push(...page)
    if (page.length < PAGE) return all
  }
}

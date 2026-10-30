// Database access with server rights for the Edge Functions, as plain HTTP
// calls to the Data API (no packages to download). The server key is
// provided by Supabase in the function's environment and never reaches the
// browser; it bypasses row level security, so only server code may use it.

const baseUrl = () => {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('SUPABASE_URL is missing')
  return url
}

function serverKey(): string {
  // new-style keys come as a JSON dictionary; the legacy key is the fallback
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    const first = keys.default ?? Object.values(keys)[0]
    if (typeof first === 'string' && first) return first
  } catch {
    // not set or not JSON
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!legacy) throw new Error('Supabase server key is missing')
  return legacy
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = serverKey()
  // new keys (sb_secret_…) go in the apikey header only; legacy keys are JWTs
  const auth: Record<string, string> = key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }
  return { apikey: key, ...auth, 'Content-Type': 'application/json', ...extra }
}

async function request(path: string, init: RequestInit & { prefer?: string } = {}) {
  const response = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: headers(init.prefer ? { Prefer: init.prefer } : {}),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]}: ${response.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

// filter: PostgREST query string, e.g. "id=eq.123" (values are URL-encoded by the caller)
export const db = {
  rpc: (fn: string, args: Record<string, unknown>) => request(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }),
  select: (table: string, query: string) => request(`${table}?${query}`),
  insert: (table: string, row: Record<string, unknown>) =>
    request(table, { method: 'POST', body: JSON.stringify(row), prefer: 'return=minimal' }),
  update: (table: string, filter: string, values: Record<string, unknown>) =>
    request(`${table}?${filter}`, { method: 'PATCH', body: JSON.stringify(values), prefer: 'return=minimal' }),
  remove: (table: string, filter: string) => request(`${table}?${filter}`, { method: 'DELETE', prefer: 'return=minimal' }),
}

export const eq = (value: string) => `eq.${encodeURIComponent(value)}`

// The signed-in user behind a token from the app (checked by Supabase Auth).
export async function userFromToken(token: string): Promise<{ id: string; email?: string } | null> {
  if (!token) return null
  const response = await fetch(`${baseUrl()}/auth/v1/user`, {
    headers: { apikey: serverKey(), Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return await response.json()
}

// The account email of a user (for reminder emails, increment 5).
export async function userEmail(userId: string): Promise<string | null> {
  const response = await fetch(`${baseUrl()}/auth/v1/admin/users/${userId}`, { headers: headers() })
  if (!response.ok) return null
  const user = await response.json()
  return user.email ?? null
}

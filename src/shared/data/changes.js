// Small builders for the changes that `useSave` takes (see hooks.js), so the
// feature hooks don't spell out { table, action, match, values } every time.
// Plain functions without React: they only describe a change, nothing is saved.

export const insert = (table, values) => ({ table, action: 'insert', values })

// `match` is an id, or an object of columns, e.g. { habit_id: id, day }
export const update = (table, match, values) => ({ table, action: 'update', match: toMatch(match), values })

export const remove = (table, match) => ({ table, action: 'delete', match: toMatch(match) })

export const upsert = (table, values) => ({ table, action: 'upsert', values })

// A change that only updates the screen – the database does it by itself
// (e.g. cascading deletes, or a column a trigger sets).
export const localOnly = (change) => ({ ...change, localOnly: true })

const toMatch = (match) => (typeof match === 'string' ? { id: match } : match)

// The moment of a change, as the database stores it.
export const nowIso = () => new Date().toISOString()

// The position for a new row at the end of `rows` (1 for the first one).
export const nextPosition = (rows) => rows.reduce((max, row) => Math.max(max, row.position), 0) + 1

// A new row id, made on the device so the row can be shown before it's saved.
// crypto.randomUUID only exists on secure pages (https or localhost); the
// fallback builds the same kind of id (UUID v4) when testing over plain http on a LAN.
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

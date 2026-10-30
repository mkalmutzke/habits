import { supabase } from './supabaseClient.js'

// Every table the app reads, how to load it and which columns identify a row.
// Each table is one cached query (key = [table name]) holding an array of rows.
export const TABLES = {
  habits: { key: ['id'], order: ['position', 'created_at'] },
  habit_completions: { key: ['habit_id', 'day'], order: ['day'] },
  habit_reminders: { key: ['id'], order: ['created_at'] },
  user_settings: { key: ['user_id'], order: ['user_id'] },
  todo_groups: { key: ['id'], order: ['position', 'created_at'] },
  todo_lists: { key: ['id'], order: ['position', 'created_at'] },
  todo_tasks: { key: ['id'], order: ['position', 'created_at'] },
  todo_steps: { key: ['id'], order: ['position', 'created_at'] },
  todo_reminders: { key: ['id'], order: ['remind_at'] },
  push_subscriptions: { key: ['id'], order: ['created_at'] },
  shopping_items: { key: ['id'], order: ['position', 'created_at'] },
  // v3.4: written by the server only (ibkr-sync); the app reads them
  portfolio_snapshots: { key: ['id'], order: ['as_of'] },
  portfolio_positions: { key: ['id'], order: ['created_at'] },
  // v3.5: written by the server only (garmin-sync); the app reads them
  garmin_days: { key: ['id'], order: ['day'] },
  garmin_activities: { key: ['id'], order: ['day'] },
}

// The Data API returns at most 1000 rows per request, so bigger tables
// (years of habit check-offs) are loaded page by page.
const PAGE_SIZE = 1000

export async function fetchTable(table) {
  const { order } = TABLES[table]
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select('*')
    for (const column of order) query = query.order(column, { ascending: true })
    // a final order on the key keeps pages stable when sort values are equal
    for (const column of TABLES[table].key) {
      if (!order.includes(column)) query = query.order(column, { ascending: true })
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

// Does `row` match every column in `match`?
export function matches(row, match) {
  return Object.entries(match).every(([column, value]) => row[column] === value)
}

// The same change the server will make, applied to the cached rows right away
// (optimistic update). Returns a new array; the old one stays untouched.
export function applyChange(rows = [], change) {
  switch (change.action) {
    case 'insert':
      return [...rows, ...[change.values].flat()]
    case 'update':
      return rows.map((row) => (matches(row, change.match) ? { ...row, ...change.values } : row))
    case 'delete':
      return rows.filter((row) => !matches(row, change.match))
    case 'upsert': {
      const keys = TABLES[change.table].key
      const incoming = [change.values].flat()
      const same = (a, b) => keys.every((key) => a[key] === b[key])
      const kept = rows.filter((row) => !incoming.some((value) => same(row, value)))
      const merged = incoming.map((value) => ({ ...rows.find((row) => same(row, value)), ...value }))
      return [...kept, ...merged]
    }
    default:
      return rows
  }
}

// Sends one change to the database. The row level security rules make sure it
// can only touch the signed-in user's own rows.
export async function runChange(change) {
  const request = REQUESTS[change.action]
  if (!request) throw new Error(`Unknown change: ${change.action}`)
  const { error } = await request(change)
  if (error) throw error
}

// The database request for each kind of change (database functions have no table).
const REQUESTS = {
  insert: ({ table, values }) => supabase.from(table).insert(values),
  update: ({ table, values, match }) => supabase.from(table).update(values).match(match),
  delete: ({ table, match }) => supabase.from(table).delete().match(match),
  upsert: ({ table, values }) => supabase.from(table).upsert(values),
  rpc: ({ fn, args }) => supabase.rpc(fn, args),
}

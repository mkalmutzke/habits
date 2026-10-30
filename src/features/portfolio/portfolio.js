import { addDays, formatShortDate, formatWeekday } from '../../shared/utils/date.js'

// The IBKR card's logic (v3.4): plain
// functions, no React. Figures come from the tables written by ibkr-sync.

// Holdings shown before "+ n more".
export const TOP_HOLDINGS = 5
// After a weekend the newest report is 3 days old; older than this means
// the morning update did not work.
export const STALE_AFTER_DAYS = 4

const percentChange = (now, before) => (now && before ? (now / before - 1) * 100 : null)

// The newest snapshot and its holdings, largest first, with cash as a last
// row – or null while there is no snapshot yet.
export function currentPortfolio(snapshots, positions) {
  const snapshot = snapshots.reduce((newest, row) => (!newest || row.as_of > newest.as_of ? row : newest), null)
  if (!snapshot) return null
  const holdings = positions
    .filter((row) => row.snapshot_id === snapshot.id)
    .map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.description ?? '',
      currency: row.currency,
      quantity: Number(row.quantity),
      value: Number(row.value_base),
      dayPct: percentChange(Number(row.mark_price), Number(row.prev_close_price)),
      dayAmount: row.day_change_base === null ? null : Number(row.day_change_base),
      totalPct: row.cost_basis_base ? (Number(row.unrealized_base) / Math.abs(Number(row.cost_basis_base))) * 100 : null,
      totalAmount: row.unrealized_base === null ? null : Number(row.unrealized_base),
    }))
    .sort((a, b) => b.value - a.value)
  const cash = snapshot.cash === null || snapshot.cash === undefined ? [] : [{ id: 'cash', symbol: 'Cash', name: snapshot.base_currency, value: Number(snapshot.cash), cash: true }]
  return { snapshot, holdings: [...holdings, ...cash] }
}

// Which day the move is from, as the header says it: "today", "yesterday",
// a weekday within the last week ("Fri"), else a date ("9 Oct").
export function dayLabel(asOf, today) {
  if (asOf === today) return 'today'
  if (asOf === addDays(today, -1)) return 'yesterday'
  if (asOf >= addDays(today, -6)) return formatWeekday(asOf)
  return formatShortDate(asOf)
}

// Is the newest report older than a normal weekend explains?
export const isStale = (asOf, today) => asOf < addDays(today, -STALE_AFTER_DAYS)

// "TWR YTD" when the period starts on 1 January, else "TWR".
export const twrLabel = (twrFrom) => (twrFrom?.endsWith('-01-01') ? 'TWR YTD' : 'TWR')

export const tone = (value) => (value > 0 ? 'up' : value < 0 ? 'down' : 'flat')

const sign = (value, signed) => (value < 0 ? '−' : signed && value > 0 ? '+' : '')

// "+0.84%", "−1.20%", "0.00%"; no value → "–".
export function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return `${sign(value, true)}${Math.abs(value).toFixed(digits)}%`
}

// Whole francs grouped the Swiss way: 45870 → "45’870". Done by hand because
// browsers and Node disagree on the separator (’ or ').
const swissGroups = (value) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '’')

// "CHF 45’870"; `signed` adds "+"; `hidden` shows "CHF •••" (and keeps the
// sign, so the direction stays visible).
export function formatMoney(value, currency, { hidden = false, signed = false } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  const digits = hidden ? '•••' : swissGroups(Math.abs(value))
  return `${sign(value, signed)}${currency} ${digits}`
}

import { addDays, weekdayIndex } from '../../shared/utils/date.js'

// Repeating tasks (like Microsoft To Do). A rule is stored in todo_tasks.repeat_rule:
//   { freq: 'daily' | 'weekly' | 'monthly' | 'yearly', interval: 1…365, weekdays?: [0…6] }
// weekdays (only for weekly): 0 = Monday … 6 = Sunday.

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// The choices offered in the task details (Custom is built from the parts).
export const REPEAT_PRESETS = {
  daily: { freq: 'daily', interval: 1 },
  weekdays: { freq: 'weekly', interval: 1, weekdays: [0, 1, 2, 3, 4] },
  weekly: { freq: 'weekly', interval: 1 },
  monthly: { freq: 'monthly', interval: 1 },
  yearly: { freq: 'yearly', interval: 1 },
}

// Which preset a rule is, or 'custom' / 'never'.
export function presetOf(rule) {
  if (!rule) return 'never'
  const found = Object.entries(REPEAT_PRESETS).find(([, preset]) => sameRule(preset, rule))
  return found ? found[0] : 'custom'
}

function sameRule(a, b) {
  return (
    a.freq === b.freq &&
    (a.interval ?? 1) === (b.interval ?? 1) &&
    JSON.stringify(normalDays(a)) === JSON.stringify(normalDays(b))
  )
}

function normalDays(rule) {
  return rule.freq === 'weekly' && rule.weekdays?.length ? [...new Set(rule.weekdays)].sort() : []
}

// The due date of the next task after `fromKey` ("YYYY-MM-DD").
export function nextDueDate(rule, fromKey) {
  const interval = Math.max(1, rule.interval ?? 1)
  switch (rule.freq) {
    case 'daily':
      return addDays(fromKey, interval)
    case 'weekly': {
      const days = normalDays(rule)
      if (!days.length) return addDays(fromKey, 7 * interval)
      const today = weekdayIndex(fromKey)
      // a later chosen day in the same week …
      const later = days.find((day) => day > today)
      if (later !== undefined) return addDays(fromKey, later - today)
      // … otherwise the first chosen day, `interval` weeks on
      const monday = addDays(fromKey, -today)
      return addDays(monday, 7 * interval + days[0])
    }
    case 'monthly':
      return addMonths(fromKey, interval)
    case 'yearly':
      return addMonths(fromKey, 12 * interval)
    default:
      throw new Error(`Unknown repeat rule: ${rule.freq}`)
  }
}

// Same day of the month, n months later; the 31st becomes the month's last day.
function addMonths(dateKey, months) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  const result = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)))
  return result.toISOString().slice(0, 10)
}

const UNITS = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }
const SIMPLE = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }

// "Daily", "Weekdays", "Every 2 weeks on Mon, Thu", …
export function describeRule(rule) {
  if (!rule) return 'Never'
  if (presetOf(rule) === 'weekdays') return 'Weekdays'
  const interval = rule.interval ?? 1
  let text = interval === 1 ? SIMPLE[rule.freq] : `Every ${interval} ${UNITS[rule.freq]}`
  const days = normalDays(rule)
  if (days.length) text += ` on ${days.map((day) => WEEKDAY_SHORT[day]).join(', ')}`
  return text
}

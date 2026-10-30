import { addDays } from '../../shared/utils/date.js'

// v3 (design §2.2): the 7 date keys ending today – the 6 days before today
// and today, today last. Both habit grids show this rolling window.
export function getRollingDays(todayKey) {
  return Array.from({ length: 7 }, (_, i) => addDays(todayKey, i - 6))
}

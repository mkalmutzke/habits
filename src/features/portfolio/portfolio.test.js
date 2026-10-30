import { describe, expect, it } from 'vitest'
import { currentPortfolio, dayLabel, formatMoney, formatPercent, isStale, tone, twrLabel } from './portfolio.js'

const TODAY = '2026-10-28' // a Wednesday

const snapshot = (id, as_of, values = {}) => ({ id, as_of, base_currency: 'CHF', nav: 1000, cash: 100, ...values })
const position = (id, snapshot_id, values) => ({
  id,
  snapshot_id,
  symbol: id.toUpperCase(),
  description: `${id} Inc`,
  currency: 'USD',
  quantity: 1,
  mark_price: 110,
  prev_close_price: 100,
  value_base: 100,
  day_change_base: 9.09,
  cost_basis_base: 80,
  unrealized_base: 20,
  ...values,
})

describe('currentPortfolio', () => {
  it('nothing stored yet → null', () => {
    expect(currentPortfolio([], [])).toBeNull()
  })

  it('the newest snapshot; its holdings largest first; cash last', () => {
    const result = currentPortfolio(
      [snapshot('s1', '2026-10-26'), snapshot('s2', '2026-10-27')],
      [position('old', 's1', { value_base: 999 }), position('a', 's2', { value_base: 200 }), position('b', 's2', { value_base: 500 })],
    )
    expect(result.snapshot.id).toBe('s2')
    expect(result.holdings.map((row) => row.symbol)).toEqual(['B', 'A', 'Cash'])
    expect(result.holdings.at(-1)).toMatchObject({ cash: true, value: 100, name: 'CHF' })
  })

  it('today’s and total change of a holding, in percent and CHF', () => {
    const [holding] = currentPortfolio([snapshot('s', '2026-10-27')], [position('a', 's', {})]).holdings
    expect(holding.dayPct).toBeCloseTo(10)
    expect(holding.dayAmount).toBe(9.09)
    expect(holding.totalPct).toBeCloseTo(25)
    expect(holding.totalAmount).toBe(20)
  })

  it('missing prices or cost basis → no percentage; no cash row without cash', () => {
    const result = currentPortfolio(
      [snapshot('s', '2026-10-27', { cash: null })],
      [position('a', 's', { prev_close_price: null, cost_basis_base: null, day_change_base: null })],
    )
    expect(result.holdings).toHaveLength(1)
    expect(result.holdings[0]).toMatchObject({ dayPct: null, dayAmount: null, totalPct: null })
  })

  it('numbers that arrive as text (Postgres numeric) are read as numbers', () => {
    const [holding] = currentPortfolio([snapshot('s', '2026-10-27')], [position('a', 's', { value_base: '1234.5' })]).holdings
    expect(holding.value).toBe(1234.5)
  })
})

describe('dayLabel and isStale', () => {
  it('today, yesterday, a weekday, then a date', () => {
    expect(dayLabel(TODAY, TODAY)).toBe('today')
    expect(dayLabel('2026-10-27', TODAY)).toBe('yesterday')
    expect(dayLabel('2026-10-23', TODAY)).toBe('Fri')
    expect(dayLabel('2026-10-09', TODAY)).toBe('9 Oct')
  })

  it('a weekend is not stale; a missed morning is', () => {
    expect(isStale('2026-10-30', '2026-11-02')).toBe(false) // Fri seen on Mon
    expect(isStale('2026-10-30', '2026-11-03')).toBe(false) // Tue, before the morning update
    expect(isStale('2026-10-30', '2026-11-04')).toBe(true) // Wed, Monday is missing
  })
})

describe('formatting', () => {
  it('percent with sign and a real minus', () => {
    expect(formatPercent(0.8412)).toBe('+0.84%')
    expect(formatPercent(-1.2)).toBe('−1.20%')
    expect(formatPercent(0)).toBe('0.00%')
    expect(formatPercent(21.44, 1)).toBe('+21.4%')
    expect(formatPercent(null)).toBe('–')
  })

  it('money in CHF with Swiss grouping; hidden keeps only the sign', () => {
    expect(formatMoney(45870.4, 'CHF')).toBe('CHF 45’870')
    expect(formatMoney(382, 'CHF', { signed: true })).toBe('+CHF 382')
    expect(formatMoney(-382, 'CHF', { signed: true })).toBe('−CHF 382')
    expect(formatMoney(45870, 'CHF', { hidden: true })).toBe('CHF •••')
    expect(formatMoney(-382, 'CHF', { hidden: true, signed: true })).toBe('−CHF •••')
    expect(formatMoney(null, 'CHF')).toBe('–')
  })

  it('tone and TWR label', () => {
    expect([tone(1), tone(-1), tone(0)]).toEqual(['up', 'down', 'flat'])
    expect(twrLabel('2026-01-01')).toBe('TWR YTD')
    expect(twrLabel('2025-10-28')).toBe('TWR')
    expect(twrLabel(null)).toBe('TWR')
  })
})

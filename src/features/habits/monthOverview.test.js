import { describe, expect, it } from 'vitest'
import { dayOverview, monthDays, monthOverview, monthStart } from './monthOverview.js'

const today = '2026-11-18'
const habit = (id, completions, breaks = [], createdAt = '2026-01-01T10:00:00') => ({ id, completions, breaks, createdAt })

describe('months (v3.8)', () => {
  it('finds this and last month, also across the year', () => {
    expect(monthStart(today)).toBe('2026-11-01')
    expect(monthStart(today, 1)).toBe('2026-10-01')
    expect(monthStart('2027-01-05', 1)).toBe('2026-12-01')
  })

  it('lists every day of a month', () => {
    expect(monthDays('2026-11-01')).toHaveLength(30)
    expect(monthDays('2026-10-01').at(-1)).toBe('2026-10-31')
    expect(monthDays('2028-02-01')).toHaveLength(29)
  })
})

describe('dayOverview (v3.8)', () => {
  const habits = [habit('walk', ['2026-11-16', '2026-11-17']), habit('gym', ['2026-11-16'], ['2026-11-17']), habit('read', ['2026-11-16', '2026-11-15'])]

  it('all done, done with breaks, some, none', () => {
    expect(dayOverview(habits, '2026-11-16', today)).toMatchObject({ state: 'full', done: 3, total: 3 })
    expect(dayOverview(habits.slice(0, 2), '2026-11-17', today)).toMatchObject({ state: 'breaks', done: 1, breaks: 1 })
    expect(dayOverview(habits, '2026-11-17', today)).toMatchObject({ state: 'some', done: 1, breaks: 1, total: 3 })
    expect(dayOverview(habits, '2026-11-14', today).state).toBe('none')
  })

  it('days after today are future; a habit only counts from the day it was added', () => {
    expect(dayOverview(habits, '2026-11-19', today).state).toBe('future')
    const added = [habit('walk', ['2026-11-10']), habit('new', [], [], '2026-11-12T08:00:00')]
    expect(dayOverview(added, '2026-11-10', today)).toMatchObject({ state: 'full', total: 1 })
    expect(dayOverview([habit('new', [], [], '2026-11-12T08:00:00')], '2026-11-10', today).state).toBe('empty')
  })
})

describe('monthOverview (v3.8)', () => {
  it('Monday-first blanks and the count of complete days', () => {
    const habits = [habit('walk', ['2026-11-02', '2026-11-03']), habit('gym', ['2026-11-02'], ['2026-11-03'])]
    const month = monthOverview(habits, '2026-11-01', today)
    // 1 November 2026 is a Sunday
    expect(month.blanks).toBe(6)
    expect(month.days).toHaveLength(30)
    expect(month.full).toBe(1)
    expect(month.withBreaks).toBe(1)
  })
})

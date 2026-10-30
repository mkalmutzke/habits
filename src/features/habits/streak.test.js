import { describe, expect, it } from 'vitest'
import { getMilestone, getStreak } from './streak.js'

describe('getStreak', () => {
  const today = '2026-10-09'

  it('is 0 with no completions', () => {
    expect(getStreak([], today)).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    expect(getStreak(['2026-10-07', '2026-10-08', '2026-10-09'], today)).toBe(3)
  })

  it('stays alive when today is not checked yet but yesterday was', () => {
    expect(getStreak(['2026-10-07', '2026-10-08'], today)).toBe(2)
  })

  it('resets to 0 when yesterday was missed and today is not checked', () => {
    expect(getStreak(['2026-10-06', '2026-10-07'], today)).toBe(0)
  })

  it('starts again at 1 when today is checked after a missed day', () => {
    expect(getStreak(['2026-10-06', '2026-10-07', '2026-10-09'], today)).toBe(1)
  })

  it('ignores order and duplicates', () => {
    expect(getStreak(['2026-10-09', '2026-10-08', '2026-10-09'], today)).toBe(2)
  })

  it('counts across a month boundary', () => {
    const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']
    expect(getStreak(days, '2026-10-02')).toBe(4)
  })

  it('counts across the summer-time switch', () => {
    const days = ['2026-03-28', '2026-03-29', '2026-03-30']
    expect(getStreak(days, '2026-03-30')).toBe(3)
  })
})

describe('getMilestone', () => {
  it('returns the highest milestone reached', () => {
    expect(getMilestone(0)).toBe(0)
    expect(getMilestone(6)).toBe(0)
    expect(getMilestone(7)).toBe(7)
    expect(getMilestone(29)).toBe(7)
    expect(getMilestone(30)).toBe(30)
    expect(getMilestone(99)).toBe(30)
    expect(getMilestone(100)).toBe(100)
    expect(getMilestone(365)).toBe(100)
  })
})

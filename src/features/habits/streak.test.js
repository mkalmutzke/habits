import { describe, expect, it } from 'vitest'
import { getMilestone, getStreak, isOnBreak } from './streak.js'

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

// v3.8 (owner): breaks keep the streak but don't add to it; three in a row end it.
describe('getStreak with breaks', () => {
  const today = '2026-11-18'
  const done = ['2026-11-12', '2026-11-13', '2026-11-14']

  it('a break bridges the gap without adding a day', () => {
    expect(getStreak([...done, '2026-11-16', '2026-11-17'], today, ['2026-11-15'])).toBe(5)
  })

  it('two breaks in a row still keep it', () => {
    expect(getStreak([...done, '2026-11-17'], today, ['2026-11-15', '2026-11-16'])).toBe(4)
  })

  it('the third break in a row ends it: only the done days after them count', () => {
    expect(getStreak(['2026-11-10', '2026-11-11', '2026-11-16', '2026-11-17'], today, ['2026-11-13', '2026-11-14', '2026-11-15'])).toBe(2)
  })

  it('three breaks up to today: back to 0', () => {
    expect(getStreak(done.concat('2026-11-15'), today, ['2026-11-16', '2026-11-17', '2026-11-18'])).toBe(0)
  })

  it('breaks that are not in a row never end it', () => {
    expect(getStreak(['2026-11-12', '2026-11-14', '2026-11-16', '2026-11-18'], today, ['2026-11-13', '2026-11-15', '2026-11-17'])).toBe(4)
  })

  it('a break today counts as marked; an open today still looks back from yesterday', () => {
    expect(getStreak(done, '2026-11-15', ['2026-11-15'])).toBe(3)
    expect(getStreak(done, '2026-11-16', ['2026-11-15'])).toBe(3)
  })

  it('breaks alone are no streak', () => {
    expect(getStreak([], today, ['2026-11-17', '2026-11-18'])).toBe(0)
  })
})

describe('isOnBreak (v3.8)', () => {
  const today = '2026-11-18'

  it('is true while the newest marked day is a break and the streak lives', () => {
    expect(isOnBreak(['2026-11-16'], today, ['2026-11-17'])).toBe(true)
    expect(isOnBreak(['2026-11-17'], today, ['2026-11-18'])).toBe(true)
  })

  it('is false after a done day, without a streak, or after the third break', () => {
    expect(isOnBreak(['2026-11-17'], today, ['2026-11-16'])).toBe(false)
    expect(isOnBreak([], today, ['2026-11-18'])).toBe(false)
    expect(isOnBreak(['2026-11-14'], today, ['2026-11-15', '2026-11-16', '2026-11-17'])).toBe(false)
  })
})

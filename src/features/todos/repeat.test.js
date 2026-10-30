import { describe, expect, it } from 'vitest'
import { describeRule, nextDueDate, presetOf, REPEAT_PRESETS } from './repeat.js'

// 2026-10-10 is a Saturday.
describe('nextDueDate', () => {
  it('daily and every n days', () => {
    expect(nextDueDate({ freq: 'daily', interval: 1 }, '2026-10-10')).toBe('2026-10-11')
    expect(nextDueDate({ freq: 'daily', interval: 3 }, '2026-10-30')).toBe('2026-11-02')
  })

  it('weekly without days: same weekday n weeks later', () => {
    expect(nextDueDate({ freq: 'weekly', interval: 1 }, '2026-10-10')).toBe('2026-10-17')
    expect(nextDueDate({ freq: 'weekly', interval: 2 }, '2026-10-10')).toBe('2026-10-24')
  })

  it('weekdays: Friday → Monday, Monday → Tuesday', () => {
    expect(nextDueDate(REPEAT_PRESETS.weekdays, '2026-10-09')).toBe('2026-10-12')
    expect(nextDueDate(REPEAT_PRESETS.weekdays, '2026-10-12')).toBe('2026-10-13')
    // a Saturday (not one of the days) → next Monday
    expect(nextDueDate(REPEAT_PRESETS.weekdays, '2026-10-10')).toBe('2026-10-12')
  })

  it('every 2 weeks on Mon and Thu', () => {
    const rule = { freq: 'weekly', interval: 2, weekdays: [3, 0] }
    expect(nextDueDate(rule, '2026-10-12')).toBe('2026-10-15') // Mon → Thu same week
    expect(nextDueDate(rule, '2026-10-15')).toBe('2026-10-26') // Thu → Mon two weeks on
  })

  it('monthly keeps the day, or the last day of shorter months', () => {
    expect(nextDueDate({ freq: 'monthly', interval: 1 }, '2026-10-10')).toBe('2026-11-10')
    expect(nextDueDate({ freq: 'monthly', interval: 1 }, '2026-01-31')).toBe('2026-02-28')
    expect(nextDueDate({ freq: 'monthly', interval: 1 }, '2026-12-15')).toBe('2027-01-15')
  })

  it('yearly, including 29 February', () => {
    expect(nextDueDate({ freq: 'yearly', interval: 1 }, '2026-10-10')).toBe('2027-10-10')
    expect(nextDueDate({ freq: 'yearly', interval: 1 }, '2028-02-29')).toBe('2029-02-28')
  })

  it('works across the change to winter time', () => {
    expect(nextDueDate({ freq: 'daily', interval: 1 }, '2026-10-25')).toBe('2026-10-26')
  })
})

describe('describeRule / presetOf', () => {
  it('names presets and custom rules', () => {
    expect(describeRule(null)).toBe('Never')
    expect(describeRule(REPEAT_PRESETS.daily)).toBe('Daily')
    expect(describeRule(REPEAT_PRESETS.weekdays)).toBe('Weekdays')
    expect(describeRule({ freq: 'weekly', interval: 2, weekdays: [3, 0] })).toBe('Every 2 weeks on Mon, Thu')
    expect(describeRule({ freq: 'monthly', interval: 3 })).toBe('Every 3 months')
  })

  it('recognises presets regardless of day order', () => {
    expect(presetOf({ freq: 'weekly', interval: 1, weekdays: [4, 3, 2, 1, 0] })).toBe('weekdays')
    expect(presetOf({ freq: 'weekly', interval: 1, weekdays: [] })).toBe('weekly')
    expect(presetOf({ freq: 'daily', interval: 2 })).toBe('custom')
    expect(presetOf(null)).toBe('never')
  })
})

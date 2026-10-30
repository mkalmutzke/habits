import { afterEach, describe, expect, it } from 'vitest'
import { addDays, formatDayLabel, formatMonth, formatTime12, formatWeekday, toDateKey, toTimeKey, weekdayIndex } from './date.js'

// Tests run in Europe/Zurich (see vite.config.js); some switch zones on purpose.
const TEST_ZONE = process.env.TZ

afterEach(() => {
  process.env.TZ = TEST_ZONE
})

describe('toDateKey (local time zone)', () => {
  it('uses local time, not UTC, late in the evening (Zurich summer time, UTC+2)', () => {
    // 22:30 UTC on 9 October = 00:30 on 10 October in Zurich
    expect(toDateKey(new Date('2026-10-09T22:30:00Z'))).toBe('2026-10-10')
  })

  it('uses local time in winter (Zurich, UTC+1)', () => {
    // 23:30 UTC on 31 December = 00:30 on 1 January in Zurich
    expect(toDateKey(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
    expect(toDateKey(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31')
  })

  it('follows whatever time zone the device is set to', () => {
    const moment = new Date('2026-10-10T02:00:00Z')
    process.env.TZ = 'America/New_York' // 22:00 on 9 October
    expect(toDateKey(moment)).toBe('2026-10-09')
    process.env.TZ = 'Asia/Tokyo' // 11:00 on 10 October
    expect(toDateKey(moment)).toBe('2026-10-10')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('moves forward too, and over leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2026-10-09', 0)).toBe('2026-10-09')
  })

  it('works the same in any device time zone', () => {
    process.env.TZ = 'Pacific/Kiritimati' // UTC+14
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28')
    process.env.TZ = 'America/Los_Angeles'
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02') // US clocks change that night
  })

  it('is not thrown off by the switch to summer time (29 March 2026)', () => {
    expect(addDays('2026-03-30', -1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28')
  })
})

describe('labels and weekdays', () => {
  it('formats the day label', () => {
    expect(formatDayLabel('2026-10-09')).toBe('Friday, 9 October')
  })

  it('keeps the same calendar day even in far-off time zones', () => {
    process.env.TZ = 'Pacific/Kiritimati' // UTC+14
    expect(formatWeekday('2026-10-09')).toBe('Fri')
    expect(weekdayIndex('2026-10-09')).toBe(4)
    process.env.TZ = 'Pacific/Pago_Pago' // UTC-11
    expect(formatWeekday('2026-10-09')).toBe('Fri')
    expect(weekdayIndex('2026-10-12')).toBe(0)
  })
})

describe('toTimeKey', () => {
  it('local hours and minutes as "HH:MM"', () => {
    expect(toTimeKey(new Date(2026, 9, 28, 7, 5))).toBe('07:05')
    expect(toTimeKey(new Date(2026, 9, 28, 23, 59))).toBe('23:59')
  })
})

describe('formatMonth', () => {
  it('names the month of a date key', () => {
    expect(formatMonth('2026-10-28')).toBe('October')
    expect(formatMonth('2027-01-01')).toBe('January')
  })
})

describe('formatTime12', () => {
  it('shows the local time with AM / PM', () => {
    expect(formatTime12(new Date(2026, 9, 28, 17, 7))).toBe('5:07 PM')
    expect(formatTime12(new Date(2026, 9, 28, 0, 30))).toBe('12:30 AM')
    expect(formatTime12(new Date(2026, 9, 28, 12, 0))).toBe('12:00 PM')
    expect(formatTime12(new Date(2026, 9, 28, 9, 5))).toBe('9:05 AM')
  })
})

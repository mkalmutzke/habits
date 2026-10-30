import { describe, expect, it } from 'vitest'
import { getRollingDays } from './week.js'

describe('getRollingDays (v3 TS-H1)', () => {
  it('returns the 6 days before today and today, today last', () => {
    expect(getRollingDays('2026-10-08')).toEqual([
      '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    ])
  })

  it('works across a month and a year change', () => {
    expect(getRollingDays('2027-01-03')).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ])
  })
})

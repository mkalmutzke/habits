import { describe, expect, it } from 'vitest'
import { formatTime, outcome, quietUntil, safeZone, zonedTimeToDate } from './schedule.js'

const ZONE = 'Europe/Zurich'

describe('quietUntil', () => {
  it('outside quiet hours → null', () => {
    // 12:00 in Zurich (summer time, UTC+2)
    expect(quietUntil(new Date('2026-07-01T10:00:00Z'), ZONE, '22:00', '07:00')).toBeNull()
  })

  it('late evening → next morning (over midnight)', () => {
    // 23:30 Zurich → 07:00 Zurich next day = 05:00 UTC
    expect(quietUntil(new Date('2026-07-01T21:30:00Z'), ZONE, '22:00:00', '07:00:00')?.toISOString()).toBe('2026-07-02T05:00:00.000Z')
  })

  it('early morning → same morning', () => {
    // 03:00 Zurich → 07:00 Zurich
    expect(quietUntil(new Date('2026-07-02T01:00:00Z'), ZONE, '22:00', '07:00')?.toISOString()).toBe('2026-07-02T05:00:00.000Z')
  })

  it('quiet hours within one day (13:00–14:00)', () => {
    expect(quietUntil(new Date('2026-07-01T11:15:00Z'), ZONE, '13:00', '14:00')?.toISOString()).toBe('2026-07-01T12:00:00.000Z')
  })

  it('night of the change to winter time (25 Oct 2026)', () => {
    // 23:00 Zurich (UTC+2) → 07:00 Zurich in winter time (UTC+1) = 06:00 UTC
    expect(quietUntil(new Date('2026-10-24T21:00:00Z'), ZONE, '22:00', '07:00')?.toISOString()).toBe('2026-10-25T06:00:00.000Z')
  })

  it('no or empty quiet hours → null', () => {
    expect(quietUntil(new Date(), ZONE, null, null)).toBeNull()
    expect(quietUntil(new Date(), ZONE, '08:00', '08:00')).toBeNull()
  })
})

describe('zonedTimeToDate / formatTime / safeZone', () => {
  it('converts wall-clock times in a zone', () => {
    expect(zonedTimeToDate({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 }, ZONE).toISOString()).toBe('2026-01-15T08:00:00.000Z')
    expect(formatTime(new Date('2026-01-15T08:00:00Z'), ZONE)).toBe('09:00')
  })

  it('unknown zones fall back to UTC', () => {
    expect(safeZone('Mars/Olympus')).toBe('UTC')
    expect(formatTime(new Date('2026-01-15T08:00:00Z'), 'Mars/Olympus')).toBe('08:00')
  })
})

describe('outcome', () => {
  const now = new Date('2026-10-10T12:00:00Z')

  it('sent when one channel worked, or nothing had to be sent', () => {
    expect(outcome({ push: 'failed', email: 'sent' }, 1, now)).toEqual({ status: 'sent' })
    expect(outcome({ inapp: 'skipped' }, 1, now)).toEqual({ status: 'sent' })
  })

  it('retried later, then failed after 3 attempts', () => {
    expect(outcome({ push: 'failed' }, 1, now)).toEqual({ status: 'pending', retryAt: new Date('2026-10-10T12:05:00Z') })
    expect(outcome({ push: 'failed' }, 2, now).retryAt).toEqual(new Date('2026-10-10T12:10:00Z'))
    expect(outcome({ push: 'failed' }, 3, now)).toEqual({ status: 'failed' })
  })
})

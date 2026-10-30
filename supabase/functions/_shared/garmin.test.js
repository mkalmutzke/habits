import { describe, expect, it } from 'vitest'
import { chunks, fetchRange, fieldNames, listOf, parseActivities, parseDays, shiftDay, todayIn } from './garmin.js'

// Made-up answers in the shape the Personal API uses (seen 28 Oct 2026) – no real data.
const DAYS = {
  data: [
    { calendarDate: '2026-10-26', movement: { steps: { value: 8120, goal: 8000, distanceInMeters: 6100 } }, heartRate: { restingValue: 52, maxValue: 140 } },
    { calendarDate: '2026-10-27', movement: { steps: { value: '4100' } }, heartRate: {} },
    { movement: { steps: { value: 10 } } },
  ],
}

const ACTIVITIES = [
  {
    activityId: 9001,
    activityName: 'Morning run',
    activityType: { typeKey: 'trail_running' },
    startTimeLocal: '2026-10-26 07:12:33',
    startTimeGMT: '2026-10-26 06:12:33',
    distance: 8123.4,
    duration: 2950.2,
    movingDuration: 2801,
  },
  { activityId: 9002, activityType: { typeKey: 'STRENGTH_TRAINING' }, startTimeLocal: '2026-10-27 18:00:00', duration: 2400 },
  { activityName: 'no id' },
]

describe('listOf', () => {
  it('finds the list in a plain list or an object holding one', () => {
    expect(listOf([1, 2])).toEqual([1, 2])
    expect(listOf({ data: [1] })).toEqual([1])
    expect(listOf({ whatever: [3] })).toEqual([3])
    expect(listOf(null)).toEqual([])
  })
})

describe('parseDays', () => {
  it('reads date, steps, goal and resting heart rate, and skips rows without a date', () => {
    expect(parseDays(DAYS)).toEqual([
      { day: '2026-10-26', steps: 8120, step_goal: 8000, resting_hr: 52 },
      { day: '2026-10-27', steps: 4100, step_goal: null, resting_hr: null },
    ])
  })

  it('also understands flat names (Garmin Connect, Health API)', () => {
    expect(parseDays([{ calendarDate: '2026-10-26', steps: 5, stepsGoal: 6, restingHeartRateInBeatsPerMinute: 50 }])).toEqual([
      { day: '2026-10-26', steps: 5, step_goal: 6, resting_hr: 50 },
    ])
  })
})

describe('parseActivities', () => {
  it('reads id, local day, GMT start, type, distance and both times', () => {
    expect(parseActivities(ACTIVITIES)).toEqual([
      {
        garmin_id: 9001,
        day: '2026-10-26',
        started_at: '2026-10-26T06:12:33Z',
        activity_type: 'trail_running',
        name: 'Morning run',
        distance_m: 8123.4,
        duration_s: 2950.2,
        moving_s: 2801,
      },
      {
        garmin_id: 9002,
        day: '2026-10-27',
        started_at: null,
        activity_type: 'strength_training',
        name: null,
        distance_m: null,
        duration_s: 2400,
        moving_s: null,
      },
    ])
  })
})

describe('fieldNames', () => {
  it('lists the names of the first row only', () => {
    expect(fieldNames([{ calendarDate: 'x', totalSteps: 1 }])).toEqual(['calendarDate', 'totalSteps'])
    expect(fieldNames([])).toEqual([])
  })

  it('looks one level into groups', () => {
    expect(fieldNames({ data: [{ calendarDate: 'x', movement: { steps: 1, goal: 2 }, list: [1] }] })).toEqual([
      'calendarDate',
      'list',
      'movement',
      'movement.goal',
      'movement.steps',
    ])
  })
})

describe('ranges', () => {
  it('shifts days across month ends', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('fetches the month and the last 7 days, whichever starts earlier', () => {
    expect(fetchRange('2026-10-28', '2026-10-28')).toEqual({ from: '2026-10-01', to: '2026-10-28' })
    expect(fetchRange('2026-11-03', '2026-11-03')).toEqual({ from: '2026-10-28', to: '2026-11-03' })
  })

  it('fetches the whole last year when nothing is stored yet, or when asked to', () => {
    expect(fetchRange('2026-10-28', null)).toEqual({ from: '2025-10-28', to: '2026-10-28' })
    expect(fetchRange('2026-10-28', '2026-10-28', true)).toEqual({ from: '2025-10-28', to: '2026-10-28' })
  })

  it('splits a range into pieces, the last one shorter', () => {
    expect(chunks({ from: '2026-10-01', to: '2026-10-10' }, 4)).toEqual([
      { from: '2026-10-01', to: '2026-10-04' },
      { from: '2026-10-05', to: '2026-10-08' },
      { from: '2026-10-09', to: '2026-10-10' },
    ])
  })

  it('knows the date in the owner’s time zone', () => {
    const lateEvening = new Date('2026-10-28T23:30:00Z')
    expect(todayIn('Europe/Zurich', lateEvening)).toBe('2026-10-29')
    expect(todayIn('UTC', lateEvening)).toBe('2026-10-28')
  })
})

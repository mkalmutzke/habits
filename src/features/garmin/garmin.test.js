import { describe, expect, it } from 'vitest'
import {
  activityGroup,
  average,
  barHeights,
  fetchedLabel,
  formatCount,
  formatDistance,
  formatClimb,
  formatDuration,
  formatElevation,
  formatThousands,
  headerSummary,
  isStale,
  leadingBlanks,
  monthLabel,
  summarize,
  viewDays,
} from './garmin.js'

// Made-up rows in the shape garmin-sync stores – no real data.
const DAYS = [
  { day: '2026-10-21', steps: 99999, resting_hr: 40, fetched_at: '2026-10-21T20:00:00Z' },
  { day: '2026-10-22', steps: 9412, resting_hr: 52, fetched_at: '2026-10-22T20:00:00Z' },
  { day: '2026-10-23', steps: 11830, resting_hr: 51, fetched_at: '2026-10-23T20:00:00Z' },
  { day: '2026-10-28', steps: 4180, resting_hr: null, fetched_at: '2026-10-28T07:42:00Z' },
]
const ACTIVITIES = [
  { day: '2026-10-22', activity_type: 'running', moving_s: 2700, duration_s: 2900, distance_m: 8200, elevation_gain_m: 85 },
  { day: '2026-10-23', activity_type: 'trail_running', moving_s: 3000, duration_s: 3300, distance_m: 9050, elevation_gain_m: 410.6 },
  { day: '2026-10-24', activity_type: 'gravel_cycling', moving_s: 5460, duration_s: 6000, distance_m: 41000, elevation_gain_m: 520 },
  { day: '2026-10-25', activity_type: 'strength_training', moving_s: null, duration_s: 1800 },
  { day: '2026-10-01', activity_type: 'walking', moving_s: 3600 },
]

describe('viewDays', () => {
  it('uses the Week page’s last 7 days', () => {
    expect(viewDays('week', '2026-10-28')).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'])
  })

  it('uses the calendar month so far (owner G10)', () => {
    const days = viewDays('month', '2026-10-28')
    expect(days).toHaveLength(28)
    expect([days[0], days.at(-1)]).toEqual(['2026-10-01', '2026-10-28'])
    expect(viewDays('month', '2026-11-01')).toEqual(['2026-11-01'])
  })
})

describe('summarize', () => {
  const week = summarize(DAYS, ACTIVITIES, viewDays('week', '2026-10-28'))

  it('gives a value per day of the view, missing days as null', () => {
    expect(week.perDay.map((row) => row.steps)).toEqual([9412, 11830, null, null, null, null, 4180])
    expect(week.perDay.at(-1)).toEqual({ day: '2026-10-28', steps: 4180, restingHr: null, elevation: null })
  })

  it('averages only the days that have a value', () => {
    expect(week.stepsAverage).toBe(8474)
    expect(week.restingHrAverage).toBe(52)
  })

  it('groups activities by type with count and moving time, duration where there is none (G4, G5)', () => {
    expect(week.activities.map(({ label, count, seconds }) => ({ label, count, seconds }))).toEqual([
      { label: 'Running', count: 2, seconds: 5700 },
      { label: 'Cycling', count: 1, seconds: 5460 },
      { label: 'Strength', count: 1, seconds: 1800 },
    ])
    expect(week.total).toMatchObject({ count: 4, seconds: 12960 })
  })

  it('v3.6: adds up the distance per type and in total (strength has none)', () => {
    expect(week.activities.map(({ label, meters }) => [label, meters])).toEqual([
      ['Running', 17250],
      ['Cycling', 41000],
      ['Strength', 0],
    ])
    expect(week.total.meters).toBe(58250)
  })

  it('v3.7: adds up the elevation gain per type, per day and in total', () => {
    expect(week.activities.map(({ label, elevation }) => [label, elevation])).toEqual([
      ['Running', 495.6],
      ['Cycling', 520],
      ['Strength', 0],
    ])
    expect(week.total.elevation).toBe(1015.6)
    // days without an activity are null; a strength day climbs 0 m
    expect(week.perDay.map((row) => row.elevation)).toEqual([85, 410.6, 520, 0, null, null, null])
  })

  it('v3.6: bar heights relative to the highest day; missing days are 0', () => {
    expect(barHeights(week.perDay).map((value) => Math.round(value * 100))).toEqual([80, 100, 0, 0, 0, 0, 35])
    expect(barHeights([{ steps: null }])).toEqual([0])
  })

  it('counts the month’s activities in the month view', () => {
    expect(summarize(DAYS, ACTIVITIES, viewDays('month', '2026-10-28')).total.count).toBe(5)
  })
})

describe('helpers', () => {
  it('v3.6: formats a distance in km, or a dash without one', () => {
    expect(formatDistance(24630)).toBe('24.6 km')
    expect(formatDistance(0)).toBe('–')
  })

  it('v3.7: formats elevation in metres, a dash without one', () => {
    expect(formatElevation(1240.6)).toBe('1’241 m')
    expect(formatElevation(0)).toBe('–')
    expect(formatClimb(412.8)).toBe('413')
    expect(formatClimb(0)).toBe('0')
    expect(formatClimb(null)).toBe('–')
  })

  it('folds Garmin type keys into groups', () => {
    expect(activityGroup('virtual_ride').label).toBe('Cycling')
    expect(activityGroup('indoor_cycling').label).toBe('Cycling')
    expect(activityGroup('hiking').label).toBe('Hiking')
    expect(activityGroup('yoga').label).toBe('Other')
  })

  it('averages and formats', () => {
    expect(average([null, undefined])).toBeNull()
    expect(formatCount(8866)).toBe('8’866')
    expect(formatCount(null)).toBe('–')
    expect(formatThousands(9412)).toBe('9.4')
    expect(formatDuration(7680)).toBe('2:08 h')
    expect(formatDuration(91500)).toBe('25:25 h')
  })

  it('builds the folded header from what exists (G3)', () => {
    expect(headerSummary({ stepsAverage: 8866, restingHrAverage: 52 })).toBe('Ø 8’866 steps · Ø 52 bpm')
    expect(headerSummary({ stepsAverage: 8866, restingHrAverage: null })).toBe('Ø 8’866 steps')
  })

  it('labels the month and its first weekday', () => {
    const days = viewDays('month', '2026-10-28')
    expect(monthLabel(days)).toBe('October · 1 – 28 Oct')
    expect(leadingBlanks(days)).toBe(3)
  })

  it('knows when the data is stale and when it was fetched (Europe/Zurich)', () => {
    expect(isStale('2026-10-25T07:00:00Z', new Date('2026-10-28T08:00:00Z'))).toBe(true)
    expect(isStale('2026-10-28T07:00:00Z', new Date('2026-10-28T08:00:00Z'))).toBe(false)
    expect(isStale(null)).toBe(false)
    expect(fetchedLabel('2026-10-28T16:07:00Z', '2026-10-28')).toBe('today 5:07 PM')
    expect(fetchedLabel('2026-10-27T07:42:00Z', '2026-10-28')).toBe('Tue 8:42 AM')
    expect(fetchedLabel('2026-10-09T07:42:00Z', '2026-10-28')).toBe('9 Oct 9:42 AM')
  })
})

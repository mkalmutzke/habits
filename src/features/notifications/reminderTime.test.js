import { describe, expect, it } from 'vitest'
import {
  defaultChannels,
  defaultRemindAt,
  describeReminder,
  fromLocalInputValue,
  isDueInApp,
  isHabitDueInApp,
  toLocalInputValue,
  toTimeInputValue,
} from './reminderTime.js'

// Tests run in Europe/Zurich (vite.config.js).
const now = new Date('2026-10-10T08:30:00Z') // 10:30 in Zurich

describe('defaultRemindAt', () => {
  it('today at the default time if still ahead, else tomorrow', () => {
    expect(defaultRemindAt(now, '14:00:00').toISOString()).toBe('2026-10-10T12:00:00.000Z')
    expect(defaultRemindAt(now, '09:00:00').toISOString()).toBe('2026-10-11T07:00:00.000Z')
  })
})

describe('local input values', () => {
  it('round-trip in local time, also across the change to winter time', () => {
    expect(toLocalInputValue('2026-10-10T12:00:00Z')).toBe('2026-10-10T14:00')
    expect(fromLocalInputValue('2026-10-10T14:00')).toBe('2026-10-10T12:00:00.000Z')
    expect(fromLocalInputValue('2026-10-26T09:00')).toBe('2026-10-26T08:00:00.000Z')
    expect(fromLocalInputValue('nonsense')).toBeNull()
  })
})

describe('describeReminder', () => {
  it('uses words for nearby days', () => {
    expect(describeReminder('2026-10-10T12:00:00Z', now)).toBe('Today 14:00')
    expect(describeReminder('2026-10-11T07:00:00Z', now)).toBe('Tomorrow 09:00')
    expect(describeReminder('2026-10-14T07:00:00Z', now)).toBe('Wed 14 Oct 09:00')
  })
})

describe('defaultChannels', () => {
  it('follows the settings and this device', () => {
    expect(defaultChannels({ inapp_on: true, email_on: false }, true)).toEqual(['inapp', 'push'])
    expect(defaultChannels({ inapp_on: false, email_on: true }, false)).toEqual(['email'])
    expect(defaultChannels({ inapp_on: false, email_on: false }, false)).toEqual(['inapp'])
  })
})

describe('isDueInApp', () => {
  const reminder = { id: 'r', remind_at: '2026-10-10T08:25:00Z', channels: ['inapp'], status: 'pending' }
  const task = { completed_at: null }

  it('due, recent, in-app, not shown yet → pop up', () => {
    expect(isDueInApp(reminder, task, now, new Set())).toBe(true)
  })

  it('not when shown before, in the future, too old, done or not in-app', () => {
    expect(isDueInApp(reminder, task, now, new Set(['r@2026-10-10T08:25:00Z']))).toBe(false)
    expect(isDueInApp({ ...reminder, remind_at: '2026-10-10T09:00:00Z' }, task, now, new Set())).toBe(false)
    expect(isDueInApp({ ...reminder, remind_at: '2026-10-10T08:00:00Z' }, task, now, new Set())).toBe(false)
    expect(isDueInApp(reminder, { completed_at: '2026-10-10T08:00:00Z' }, now, new Set())).toBe(false)
    expect(isDueInApp({ ...reminder, channels: ['push'] }, task, now, new Set())).toBe(false)
  })
})

describe('isHabitDueInApp (v3 TS-R8)', () => {
  const now = new Date(2026, 9, 8, 18, 45) // Thu 8 Oct, 18:45 local
  const habit = { id: 'h', completions: ['2026-10-07'] }
  const reminder = { id: 'r', active: true, channels: ['inapp', 'push'], remind_time: '18:30:00', starts_on: '2026-10-01' }

  it('pops up after its time when the habit isn’t done today', () => {
    expect(isHabitDueInApp(reminder, habit, now, new Set())).toBe(true)
  })

  it('not before its time, not when done, not twice a day, not without in-app, not when off', () => {
    expect(isHabitDueInApp(reminder, habit, new Date(2026, 9, 8, 18, 0), new Set())).toBe(false)
    expect(isHabitDueInApp(reminder, { ...habit, completions: ['2026-10-08'] }, now, new Set())).toBe(false)
    expect(isHabitDueInApp(reminder, habit, now, new Set(['habit:r@2026-10-08']))).toBe(false)
    expect(isHabitDueInApp({ ...reminder, channels: ['push'] }, habit, now, new Set())).toBe(false)
    expect(isHabitDueInApp({ ...reminder, active: false }, habit, now, new Set())).toBe(false)
  })

  it('not before its first day (set after its time → starts tomorrow), like the server', () => {
    expect(isHabitDueInApp({ ...reminder, starts_on: '2026-10-09' }, habit, now, new Set())).toBe(false)
    expect(isHabitDueInApp({ ...reminder, starts_on: '2026-10-08' }, habit, now, new Set())).toBe(true)
  })

  it('formats the time for the time field', () => {
    expect(toTimeInputValue('08:05:00')).toBe('08:05')
  })
})

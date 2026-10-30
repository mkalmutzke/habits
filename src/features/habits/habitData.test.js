import { describe, expect, it } from 'vitest'
import { firstReminderDay, reminderChanges, shapeHabits } from './habitData.js'

const habit = (id, position, created_at = '2026-10-01T10:00:00Z') => ({ id, name: id, emoji: '📚', position, created_at })

describe('shapeHabits', () => {
  it('sorts by position and collects each habit’s check-off days', () => {
    const shaped = shapeHabits(
      [habit('b', 2), habit('a', 1)],
      [
        { habit_id: 'a', day: '2026-10-27' },
        { habit_id: 'b', day: '2026-10-27' },
        { habit_id: 'a', day: '2026-10-28' },
      ],
    )
    expect(shaped.map((item) => [item.id, item.completions])).toEqual([
      ['a', ['2026-10-27', '2026-10-28']],
      ['b', ['2026-10-27']],
    ])
  })

  it('a missing subtitle becomes an empty text; no check-offs an empty list', () => {
    expect(shapeHabits([habit('a', 1)], [])[0]).toMatchObject({ subtitle: '', completions: [], createdAt: '2026-10-01T10:00:00Z' })
  })
})

describe('firstReminderDay', () => {
  it('today while the time is still to come, else tomorrow', () => {
    expect(firstReminderDay('09:00:00', new Date(2026, 9, 28, 8, 59))).toBe('2026-10-28')
    expect(firstReminderDay('09:00:00', new Date(2026, 9, 28, 9, 0))).toBe('2026-10-29')
    expect(firstReminderDay('09:00', new Date(2026, 11, 31, 22, 0))).toBe('2027-01-01')
  })
})

describe('reminderChanges', () => {
  const now = new Date(2026, 9, 28, 8, 0)
  const existing = { id: 'r1', remind_time: '09:00:00', channels: ['push'], active: true }
  const reminder = { remind_time: '09:00', channels: ['push'] }

  it('no reminder chosen: removes the stored one, or does nothing', () => {
    expect(reminderChanges({ habitId: 'h', existing, reminder: null, now })).toEqual([
      { table: 'habit_reminders', action: 'delete', match: { id: 'r1' } },
    ])
    expect(reminderChanges({ habitId: 'h', existing: undefined, reminder: null, now })).toEqual([])
  })

  it('the same reminder again: nothing to save', () => {
    expect(reminderChanges({ habitId: 'h', existing, reminder, now })).toEqual([])
  })

  it('a changed reminder is updated and starts again (starts_on only on screen)', () => {
    const changes = reminderChanges({ habitId: 'h', existing, reminder: { ...reminder, channels: ['email'] }, now })
    expect(changes).toEqual([
      { table: 'habit_reminders', action: 'update', match: { id: 'r1' }, values: { remind_time: '09:00', channels: ['email'], active: true } },
      { table: 'habit_reminders', action: 'update', match: { id: 'r1' }, values: { starts_on: '2026-10-28' }, localOnly: true },
    ])
  })

  it('a paused reminder counts as changed', () => {
    expect(reminderChanges({ habitId: 'h', existing: { ...existing, active: false }, reminder, now })).toHaveLength(2)
  })

  it('a new reminder is inserted for the habit and shown with its first day', () => {
    const [created, startsOn] = reminderChanges({ habitId: 'h', userId: 'u', existing: undefined, reminder, now })
    expect(created).toMatchObject({ table: 'habit_reminders', action: 'insert', values: { user_id: 'u', habit_id: 'h', remind_time: '09:00', active: true } })
    expect(startsOn).toEqual({ table: 'habit_reminders', action: 'update', match: { id: created.values.id }, values: { starts_on: '2026-10-28' }, localOnly: true })
  })
})

import { describe, expect, it } from 'vitest'
import { daysLeft, describeDue, isCompleted, isDeleted, isOpen, matchesSearch } from './smartLists.js'

const TODAY = '2026-10-10'
const task = (values) => ({
  id: 'x',
  list_id: null,
  title: 'Task',
  notes: '',
  due_date: null,
  important: false,
  completed_at: null,
  position: 1,
  created_at: '2026-10-01T10:00:00Z',
  ...values,
})

describe('describeDue', () => {
  it('uses words for nearby days and marks overdue tasks', () => {
    expect(describeDue(TODAY, TODAY)).toEqual({ text: 'Today', tone: 'today' })
    expect(describeDue('2026-10-11', TODAY)).toEqual({ text: 'Tomorrow', tone: 'later' })
    expect(describeDue('2026-10-09', TODAY)).toEqual({ text: 'Yesterday', tone: 'overdue' })
    expect(describeDue('2026-10-14', TODAY)).toEqual({ text: 'Wed 14 Oct', tone: 'later' })
    expect(describeDue(null, TODAY)).toBeNull()
  })
})

describe('matchesSearch', () => {
  it('finds words in title, notes and steps, ignoring case', () => {
    const t = task({ title: 'Call the dentist', notes: 'Practice: 030 123' })
    expect(matchesSearch(t, [], 'DENTIST')).toBe(true)
    expect(matchesSearch(t, [], '030')).toBe(true)
    expect(matchesSearch(t, [{ title: 'Find the number' }], 'number')).toBe(true)
    expect(matchesSearch(t, [], 'bananas')).toBe(false)
    expect(matchesSearch(t, [], '   ')).toBe(false)
  })
})

describe('deleted tasks (v3 D1)', () => {
  it('a deleted task is neither open nor completed', () => {
    const deleted = task({ deleted_at: '2026-10-10T10:00:00Z' })
    expect(isDeleted(deleted)).toBe(true)
    expect(isOpen(deleted)).toBe(false)
    expect(isCompleted({ ...deleted, completed_at: '2026-10-09T10:00:00Z' })).toBe(false)
    expect(isOpen(task({}))).toBe(true)
  })

  it('counts the days until it is removed for good (10 days)', () => {
    const deleted = task({ deleted_at: '2026-10-10T10:00:00Z' })
    expect(daysLeft(deleted, new Date('2026-10-10T10:00:00Z'))).toBe(10)
    expect(daysLeft(deleted, new Date('2026-10-17T09:00:00Z'))).toBe(4)
    expect(daysLeft(deleted, new Date('2026-10-25T10:00:00Z'))).toBe(0)
  })
})

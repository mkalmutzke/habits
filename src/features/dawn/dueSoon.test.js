import { describe, expect, it } from 'vitest'
import { dueDayLabel, dueSoon } from './dueSoon.js'

const TODAY = '2026-10-21' // a Wednesday
let next = 0
const task = (values) => ({
  id: `t${(next += 1)}`,
  list_id: null,
  title: 'Task',
  due_date: null,
  completed_at: null,
  deleted_at: null,
  position: 1,
  created_at: '2026-10-01T10:00:00Z',
  ...values,
})
const titles = (tasks) => tasks.map((item) => item.title)

describe('dueSoon (design v3.3 §3.4)', () => {
  it('overdue before today; today up to today + 6; not today + 7 or no date (TS-D1)', () => {
    const result = dueSoon(
      [
        task({ title: 'yesterday', due_date: '2026-10-20' }),
        task({ title: 'today', due_date: TODAY }),
        task({ title: 'plus 6', due_date: '2026-10-27' }),
        task({ title: 'plus 7', due_date: '2026-10-28' }),
        task({ title: 'no date' }),
      ],
      TODAY,
    )
    expect(titles(result.overdue)).toEqual(['yesterday'])
    expect(result.days.map((group) => [group.day, titles(group.tasks)])).toEqual([
      [TODAY, ['today']],
      ['2026-10-27', ['plus 6']],
    ])
    expect(result.counts).toEqual({ overdue: 1, week: 2 })
  })

  it('leaves out completed and deleted tasks; keeps every list and tasks without a list (TS-D2, Q3)', () => {
    const result = dueSoon(
      [
        task({ title: 'done', due_date: TODAY, completed_at: '2026-10-21T08:00:00Z' }),
        task({ title: 'deleted', due_date: TODAY, deleted_at: '2026-10-21T08:00:00Z' }),
        task({ title: 'hidden list', due_date: TODAY, list_id: 'work' }),
        task({ title: 'no list', due_date: TODAY }),
      ],
      TODAY,
    )
    expect(titles(result.days[0].tasks)).toEqual(['hidden list', 'no list'])
    expect(result.counts).toEqual({ overdue: 0, week: 2 })
  })

  it('order: overdue oldest first, then by day, inside a day by own order (TS-D3)', () => {
    const result = dueSoon(
      [
        task({ title: 'B', due_date: '2026-10-19', position: 1 }),
        task({ title: 'A', due_date: '2026-10-12', position: 5 }),
        task({ title: 'second', due_date: '2026-10-23', position: 2 }),
        task({ title: 'first', due_date: '2026-10-23', position: 1 }),
        task({ title: 'tomorrow', due_date: '2026-10-22', position: 9 }),
      ],
      TODAY,
    )
    expect(titles(result.overdue)).toEqual(['A', 'B'])
    expect(result.days.map((group) => titles(group.tasks))).toEqual([['tomorrow'], ['first', 'second']])
  })

  it('works across a year end (TS-D4)', () => {
    const result = dueSoon([task({ title: 'new year', due_date: '2027-01-02' }), task({ title: 'too late', due_date: '2027-01-05' })], '2026-12-29')
    expect(result.days.map((group) => group.day)).toEqual(['2027-01-02'])
  })

  it('nothing due: empty groups, zero counts', () => {
    expect(dueSoon([], TODAY)).toEqual({ overdue: [], days: [], counts: { overdue: 0, week: 0 } })
  })
})

describe('dueDayLabel', () => {
  it('names today and tomorrow', () => {
    expect(dueDayLabel(TODAY, TODAY)).toBe('Today · Wed 21 Oct')
    expect(dueDayLabel('2026-10-22', TODAY)).toBe('Tomorrow · Thu 22 Oct')
    expect(dueDayLabel('2026-10-23', TODAY)).toBe('Fri 23 Oct')
  })
})

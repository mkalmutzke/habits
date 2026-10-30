import { describe, expect, it } from 'vitest'
import { addDefaults, describeSource, inSource, isInAll, resolveSource, sortOpen, sourceOptions } from './sources.js'

const TODAY = '2026-10-08'
const groups = [{ id: 'g1', name: 'Home', position: 1, created_at: '2026-10-01T10:00:00Z' }]
const lists = [
  { id: 'garden', name: 'Garden', group_id: 'g1', color: 'green', position: 2, created_at: '2026-10-01T10:00:00Z' },
  { id: 'dog', name: 'Bello', group_id: 'g1', color: 'amber', position: 1, created_at: '2026-10-01T10:00:00Z' },
  { id: 'work', name: 'Work', group_id: null, color: 'blue', position: 3, created_at: '2026-10-01T10:00:00Z' },
]
const task = (values) => ({
  id: 'x',
  list_id: null,
  title: 'Task',
  due_date: null,
  important: false,
  completed_at: null,
  position: 1,
  created_at: '2026-10-01T10:00:00Z',
  ...values,
})

describe('inSource', () => {
  it('All holds every task, also those without a list (D5)', () => {
    expect(inSource(task({ list_id: null }), 'all', lists)).toBe(true)
    expect(inSource(task({ list_id: 'work' }), 'all', lists)).toBe(true)
  })

  it('v3.3: All leaves out lists set to “not in All”; no list and old rows stay in (TS-A1)', () => {
    const hidden = [...lists.filter((list) => list.id !== 'work'), { ...lists[2], show_in_all: false }]
    expect(inSource(task({ list_id: 'work' }), 'all', hidden)).toBe(false)
    expect(inSource(task({ list_id: 'dog' }), 'all', hidden)).toBe(true)
    expect(inSource(task({ list_id: null }), 'all', hidden)).toBe(true)
    expect(isInAll({ id: 'old' })).toBe(true)
    expect(isInAll({ id: 'on', show_in_all: true })).toBe(true)
  })

  it('v3.3: Important, Planned, a group and the list itself ignore “not in All” (TS-A2)', () => {
    const hidden = lists.map((list) => ({ ...list, show_in_all: false }))
    expect(inSource(task({ list_id: 'work', important: true }), 'important', hidden)).toBe(true)
    expect(inSource(task({ list_id: 'work', due_date: TODAY }), 'planned', hidden)).toBe(true)
    expect(inSource(task({ list_id: 'dog' }), 'group:g1', hidden)).toBe(true)
    expect(inSource(task({ list_id: 'work' }), 'work', hidden)).toBe(true)
  })

  it('Important, Planned, a list', () => {
    expect(inSource(task({ important: true }), 'important', lists)).toBe(true)
    expect(inSource(task({}), 'important', lists)).toBe(false)
    expect(inSource(task({ due_date: TODAY }), 'planned', lists)).toBe(true)
    expect(inSource(task({ list_id: 'work' }), 'work', lists)).toBe(true)
    expect(inSource(task({ list_id: 'dog' }), 'work', lists)).toBe(false)
  })

  it('a group holds the tasks of all its lists', () => {
    expect(inSource(task({ list_id: 'dog' }), 'group:g1', lists)).toBe(true)
    expect(inSource(task({ list_id: 'garden' }), 'group:g1', lists)).toBe(true)
    expect(inSource(task({ list_id: 'work' }), 'group:g1', lists)).toBe(false)
    expect(inSource(task({ list_id: null }), 'group:g1', lists)).toBe(false)
  })
})

describe('sortOpen (D6, TS-T2)', () => {
  it('All: overdue, today, later, no date – then own order', () => {
    const tasks = [
      task({ id: 'none2', position: 2 }),
      task({ id: 'later', due_date: '2026-10-20' }),
      task({ id: 'none1', position: 1 }),
      task({ id: 'today', due_date: TODAY }),
      task({ id: 'overdue', due_date: '2026-10-01' }),
    ]
    expect(sortOpen(tasks, 'all').map((t) => t.id)).toEqual(['overdue', 'today', 'later', 'none1', 'none2'])
  })

  it('a list keeps its own order', () => {
    const tasks = [task({ id: 'b', position: 2, due_date: TODAY }), task({ id: 'a', position: 1 })]
    expect(sortOpen(tasks, 'work').map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('resolveSource (TS-T4, TS-L1)', () => {
  it('keeps known sources', () => {
    expect(resolveSource('planned', lists, groups)).toBe('planned')
    expect(resolveSource('group:g1', lists, groups)).toBe('group:g1')
    expect(resolveSource('work', lists, groups)).toBe('work')
  })

  it('old My Day / Tasks addresses and deleted lists or groups show All', () => {
    expect(resolveSource('my-day', lists, groups)).toBe('all')
    expect(resolveSource('tasks', lists, groups)).toBe('all')
    expect(resolveSource('gone', lists, groups)).toBe('all')
    expect(resolveSource('group:gone', lists, groups)).toBe('all')
    expect(resolveSource(null, lists, groups)).toBe('all')
  })
})

describe('addDefaults (TS-T7)', () => {
  it('sets what the source stands for', () => {
    expect(addDefaults('all', lists, TODAY)).toEqual({ listId: null, important: false, dueDate: null })
    expect(addDefaults('important', lists, TODAY)).toMatchObject({ important: true })
    expect(addDefaults('planned', lists, TODAY)).toMatchObject({ dueDate: TODAY })
    expect(addDefaults('work', lists, TODAY)).toMatchObject({ listId: 'work' })
  })

  it('a group puts the task into its first list', () => {
    expect(addDefaults('group:g1', lists, TODAY)).toMatchObject({ listId: 'dog' })
  })
})

describe('sourceOptions and describeSource', () => {
  it('lists All, Important, Planned, each group with its lists, then lists without a group', () => {
    expect(sourceOptions(lists, groups).map((o) => o.name)).toEqual(['All', 'Important', 'Planned', 'Home', 'Bello', 'Garden', 'Work'])
  })

  it('names sources', () => {
    expect(describeSource('all', lists, groups).name).toBe('All')
    expect(describeSource('group:g1', lists, groups)).toMatchObject({ name: 'Home', kind: 'group' })
    expect(describeSource('dog', lists, groups)).toMatchObject({ name: 'Bello', color: 'amber' })
  })
})

import { describe, expect, it } from 'vitest'
import { insert, localOnly, newId, nextPosition, remove, update, upsert } from './changes.js'

describe('change builders', () => {
  it('describe insert, update, delete and upsert', () => {
    expect(insert('habits', { id: 'h1' })).toEqual({ table: 'habits', action: 'insert', values: { id: 'h1' } })
    expect(update('habits', 'h1', { name: 'Read' })).toEqual({ table: 'habits', action: 'update', match: { id: 'h1' }, values: { name: 'Read' } })
    expect(remove('habit_completions', { habit_id: 'h1', day: '2026-10-28' })).toEqual({
      table: 'habit_completions',
      action: 'delete',
      match: { habit_id: 'h1', day: '2026-10-28' },
    })
    expect(upsert('user_settings', { user_id: 'u' })).toEqual({ table: 'user_settings', action: 'upsert', values: { user_id: 'u' } })
  })

  it('a plain id becomes { id }', () => {
    expect(remove('habits', 'h1').match).toEqual({ id: 'h1' })
  })

  it('localOnly marks a change without touching the original', () => {
    const change = remove('todo_steps', { task_id: 't1' })
    expect(localOnly(change)).toEqual({ ...change, localOnly: true })
    expect(change.localOnly).toBeUndefined()
  })
})

describe('nextPosition', () => {
  it('is one more than the highest position, 1 for an empty list', () => {
    expect(nextPosition([])).toBe(1)
    expect(nextPosition([{ position: 3 }, { position: 1.5 }])).toBe(4)
  })
})

describe('newId', () => {
  it('makes UUID v4 ids', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

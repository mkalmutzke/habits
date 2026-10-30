import { describe, expect, it } from 'vitest'
import { parseRoute } from './useRoute.js'

describe('parseRoute', () => {
  it('reads the view and id', () => {
    expect(parseRoute('#/task/abc')).toEqual({ view: 'task', id: 'abc', query: {} })
    expect(parseRoute('#/list/group%3Ag1')).toMatchObject({ view: 'list', id: 'group:g1' })
  })

  it('reads the query of a new task (v3 §2.3)', () => {
    expect(parseRoute('#/task/new?source=group%3Ag1')).toEqual({ view: 'task', id: 'new', query: { source: 'group:g1' } })
  })

  it('falls back to What’s up? and to Lists', () => {
    expect(parseRoute('#/nonsense')).toMatchObject({ view: 'today', id: null })
    expect(parseRoute('')).toMatchObject({ view: 'today' })
    expect(parseRoute('#/task')).toMatchObject({ view: 'lists' })
  })
})

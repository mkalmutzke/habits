// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The stored row stays the same between the two saves – like a quick second
// tap before the screen copy has been updated (found by CI in v3.9).
const saved = []
vi.mock('../../shared/data/hooks.js', () => {
  const row = { user_id: 'u', brief_prefs: { jobs: { topics: ['hiring', 'remote'], max: 8 } }, inapp_on: true }
  return {
    useTable: () => ({ rows: [row], loading: false }),
    useSave: () => (change) => saved.push(change),
    useOnline: () => true,
  }
})

const { useSettings } = await import('./useSettings.js')

describe('useSettings.update (v3.9)', () => {
  it('sends only the changed columns and builds on changes still on their way', () => {
    const { result } = renderHook(() => useSettings('u'))
    result.current.update({ inapp_on: false })
    result.current.update((current) => ({ brief_prefs: { ...current.brief_prefs, jobs: { ...current.brief_prefs.jobs, topics: ['hiring'] } } }))
    result.current.update((current) => ({ brief_prefs: { ...current.brief_prefs, jobs: { ...current.brief_prefs.jobs, max: 5 } } }))
    expect(saved.map((change) => change.values)).toEqual([
      { inapp_on: false, user_id: 'u' },
      { brief_prefs: { jobs: { topics: ['hiring'], max: 8 } }, user_id: 'u' },
      // the second brief change keeps the first one (before the fix it brought 'remote' back)
      { brief_prefs: { jobs: { topics: ['hiring'], max: 5 } }, user_id: 'u' },
    ])
  })
})

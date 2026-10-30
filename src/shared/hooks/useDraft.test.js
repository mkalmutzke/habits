// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDraft } from './useDraft.js'

describe('useDraft', () => {
  it('typing changes only the draft; a new saved value replaces it', () => {
    const { result, rerender } = renderHook(({ saved }) => useDraft(saved), { initialProps: { saved: 'Milk' } })
    act(() => result.current[1]('Oat milk'))
    expect(result.current[0]).toBe('Oat milk')

    // same saved value again (e.g. another field saved): the draft stays
    rerender({ saved: 'Milk' })
    expect(result.current[0]).toBe('Oat milk')

    // saved on another device: the field follows
    rerender({ saved: 'Soy milk' })
    expect(result.current[0]).toBe('Soy milk')
  })
})

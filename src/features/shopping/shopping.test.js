import { describe, expect, it } from 'vitest'
import { cleanTitle, sortItems } from './shopping.js'

const item = (values) => ({ id: 'x', title: 'Item', ticked_at: null, position: 1, created_at: '2026-10-11T10:00:00Z', ...values })

describe('sortItems (TS-K3)', () => {
  it('ticked items move to the bottom, in the order they were ticked', () => {
    const items = [
      item({ id: 'milk', position: 1, ticked_at: '2026-10-11T12:00:00Z' }),
      item({ id: 'bread', position: 2 }),
      item({ id: 'eggs', position: 3, ticked_at: '2026-10-11T11:00:00Z' }),
      item({ id: 'coffee', position: 4 }),
    ]
    expect(sortItems(items).map((i) => i.id)).toEqual(['bread', 'coffee', 'eggs', 'milk'])
  })

  it('unticking puts an item back in its place', () => {
    const items = [item({ id: 'b', position: 2 }), item({ id: 'a', position: 1 })]
    expect(sortItems(items).map((i) => i.id)).toEqual(['a', 'b'])
  })
})

describe('cleanTitle (TS-K5)', () => {
  it('trims and limits to 200 characters', () => {
    expect(cleanTitle('  Oat milk ')).toBe('Oat milk')
    expect(cleanTitle('x'.repeat(250))).toHaveLength(200)
  })

  it('returns null for an empty text', () => {
    expect(cleanTitle('   ')).toBeNull()
  })
})

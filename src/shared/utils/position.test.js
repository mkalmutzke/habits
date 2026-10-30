import { describe, expect, it } from 'vitest'
import { planMove, positionBetween } from './position.js'

const items = (...positions) => positions.map((position, index) => ({ id: `h${index + 1}`, position }))

describe('positionBetween', () => {
  it('lies between, before the first or after the last', () => {
    expect(positionBetween(1, 2)).toBe(1.5)
    expect(positionBetween(undefined, 1)).toBe(0)
    expect(positionBetween(3, undefined)).toBe(4)
    expect(positionBetween(undefined, undefined)).toBe(1)
  })
})

describe('planMove (v3.3 TS-O1/O2)', () => {
  const four = items(1, 2, 3, 4)

  it('to the top: one row, before the first', () => {
    expect(planMove(four, 2, 0)).toEqual([{ id: 'h3', position: 0 }])
  })

  it('to the bottom: one row, after the last', () => {
    expect(planMove(four, 0, 3)).toEqual([{ id: 'h1', position: 5 }])
  })

  it('into the middle, up and down', () => {
    expect(planMove(four, 3, 1)).toEqual([{ id: 'h4', position: 1.5 }])
    expect(planMove(four, 0, 2)).toEqual([{ id: 'h1', position: 3.5 }])
  })

  it('same place, out of range or a list of one: nothing to save', () => {
    expect(planMove(four, 2, 2)).toEqual([])
    expect(planMove(four, 0, 4)).toEqual([])
    expect(planMove(four, -1, 0)).toEqual([])
    expect(planMove(items(1), 0, 0)).toEqual([])
  })

  it('neighbours with the same position (older data): numbers the list, only changed rows', () => {
    // h1 h2 h3 all at 0; move h3 between h1 and h2
    expect(planMove(items(0, 0, 0), 2, 1)).toEqual([
      { id: 'h1', position: 1 },
      { id: 'h3', position: 2 },
      { id: 'h2', position: 3 },
    ])
    // already numbered rows are left alone
    expect(planMove(items(1, 2, 2, 4), 3, 2)).toEqual([
      { id: 'h4', position: 3 },
      { id: 'h3', position: 4 },
    ])
  })
})

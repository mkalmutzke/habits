import { describe, expect, it } from 'vitest'
import { cleanText } from './text.js'

describe('cleanText', () => {
  it('trims and cuts to the maximum length', () => {
    expect(cleanText('  Milk  ', 60)).toBe('Milk')
    expect(cleanText('abcdef', 3)).toBe('abc')
  })

  it('only spaces → empty text', () => {
    expect(cleanText('   ', 60)).toBe('')
  })
})

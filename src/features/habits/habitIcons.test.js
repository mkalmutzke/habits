import { describe, expect, it } from 'vitest'
import { HABIT_ICONS, iconChoices } from './habitIcons.js'

describe('habit icons (TS-H7)', () => {
  it('offers exactly Dog, Sport, Medication and Other', () => {
    expect(HABIT_ICONS.map((icon) => `${icon.emoji} ${icon.label}`)).toEqual([
      '🐕 Dog',
      '🏃 Sport',
      '💊 Medication',
      '✨ Other',
    ])
  })

  it('keeps an older emoji as a fifth choice “Current”', () => {
    expect(iconChoices('💧').at(-1)).toEqual({ emoji: '💧', label: 'Current' })
    expect(iconChoices('💧')).toHaveLength(5)
  })

  it('adds nothing for one of the four or a new habit', () => {
    expect(iconChoices('🏃')).toHaveLength(4)
    expect(iconChoices(undefined)).toHaveLength(4)
  })
})

import { describe, expect, it } from 'vitest'
import { garminDisplay, ibkrShown } from './modules.js'

describe('modules (v3.8)', () => {
  it('start as in v3.7: IBKR card and Garmin icon', () => {
    expect(ibkrShown({})).toBe(true)
    expect(garminDisplay({})).toBe('icon')
    expect(garminDisplay(undefined)).toBe('icon')
  })

  it('follow the settings', () => {
    expect(ibkrShown({ ibkr_display: 'off' })).toBe(false)
    expect(garminDisplay({ garmin_display: 'section' })).toBe('section')
    expect(garminDisplay({ garmin_display: 'off' })).toBe('off')
    expect(garminDisplay({ garmin_display: 'something else' })).toBe('icon')
  })
})

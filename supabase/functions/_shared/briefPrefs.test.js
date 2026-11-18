import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, cleanEntry, normalizePrefs, prefsForRun } from './briefPrefs.js'

describe('brief settings (v3.9)', () => {
  it('without settings, every brief works as before', () => {
    expect(normalizePrefs('jobs', undefined)).toEqual(DEFAULT_PREFS.jobs)
    expect(normalizePrefs('world', {})).toEqual(DEFAULT_PREFS.world)
    expect(normalizePrefs('ibkr', 'nonsense')).toEqual(DEFAULT_PREFS.ibkr)
    expect(normalizePrefs('weather', {})).toBe(null)
  })

  it('keeps chosen values and trims texts', () => {
    const prefs = normalizePrefs('jobs', {
      icon: false,
      title: '  My   job market  ',
      countries: ['Canada', 'Switzerland', 'canada', ''],
      titles: ['BI Architect'],
      topics: ['remote', 'hiring', 'astrology'],
      about: 'SAP consultant',
      max: 12,
    })
    expect(prefs).toMatchObject({ icon: false, title: 'My job market', countries: ['Canada', 'Switzerland'], titles: ['BI Architect'], topics: ['hiring', 'remote'], about: 'SAP consultant', max: 12 })
  })

  it('limits numbers, lengths and list sizes', () => {
    const prefs = normalizePrefs('world', { max: 99, title: 'x'.repeat(80), regions: Array.from({ length: 20 }, (_, i) => `Region ${i}`), extra: 'y'.repeat(500) })
    expect(prefs.max).toBe(15)
    expect(prefs.title).toHaveLength(40)
    expect(prefs.regions).toHaveLength(10)
    expect(prefs.extra).toHaveLength(300)
    expect(normalizePrefs('world', { max: 1 }).max).toBe(3)
    expect(normalizePrefs('world', { max: 7.5 }).max).toBe(8)
  })

  it('symbols are upper case and plain', () => {
    expect(cleanEntry(' nvda ', true)).toBe('NVDA')
    expect(cleanEntry('BRK.B', true)).toBe('BRK.B')
    expect(cleanEntry('<b>x</b>', true)).toBe('')
    expect(normalizePrefs('ibkr', { watchlist: ['nvda', 'NVDA', 'msft'] }).watchlist).toEqual(['NVDA', 'MSFT'])
  })

  it('the morning run gets topic labels and no icon flag', () => {
    const run = prefsForRun('world', { topics: ['politics', 'sport'], icon: false })
    expect(run.topics).toEqual(['Politics', 'Sport'])
    expect(run).not.toHaveProperty('icon')
  })
})

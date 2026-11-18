import { describe, expect, it } from 'vitest'
import { briefDate, briefPrefs, briefTitle, iconShown, isNew, isOn, itemCount } from './briefs.js'

const TODAY = '2026-11-03'

describe('briefs (v3.6)', () => {
  it('isOn: on unless switched off in Settings', () => {
    expect(isOn({}, 'jobs')).toBe(true)
    expect(isOn({ brief_jobs_on: false }, 'jobs')).toBe(false)
    expect(isOn({ brief_jobs_on: false }, 'world')).toBe(true)
  })

  it('isNew: today’s brief, not opened today', () => {
    expect(isNew(null, TODAY)).toBe(false)
    expect(isNew({ for_day: TODAY, seen_on: null }, TODAY)).toBe(true)
    expect(isNew({ for_day: TODAY, seen_on: TODAY }, TODAY)).toBe(false)
    // yesterday's brief (a run failed): no dot
    expect(isNew({ for_day: '2026-11-02', seen_on: null }, TODAY)).toBe(false)
  })

  it('briefDate: today, from yesterday, or from an older day', () => {
    expect(briefDate({ for_day: TODAY }, TODAY)).toBe('Today')
    expect(briefDate({ for_day: '2026-11-02' }, TODAY)).toBe('From yesterday · Mon 2 Nov')
    expect(briefDate({ for_day: '2026-10-31' }, TODAY)).toBe('From Sat 31 Oct')
    expect(briefDate(null, TODAY)).toBeNull()
  })

  it('itemCount counts the headlines of all sections', () => {
    expect(itemCount({ sections: [{ items: [1, 2] }, { items: [3] }] })).toBe(3)
    expect(itemCount({})).toBe(0)
  })
})

describe('brief settings in the app (v3.9)', () => {
  it('the icon shows while the brief runs and its icon is on', () => {
    expect(iconShown({}, 'world')).toBe(true)
    expect(iconShown({ brief_prefs: { world: { icon: false } } }, 'world')).toBe(false)
    expect(iconShown({ brief_world_on: false }, 'world')).toBe(false)
  })

  it('names: own title, the country of the job brief, or the usual name', () => {
    expect(briefTitle({}, 'jobs')).toBe('Canada jobs brief')
    expect(briefTitle({ brief_prefs: { jobs: { countries: ['Canada', 'Switzerland'] } } }, 'jobs')).toBe('Job market brief')
    expect(briefTitle({ brief_prefs: { jobs: { countries: ['Switzerland'] } } }, 'jobs')).toBe('Switzerland jobs brief')
    expect(briefTitle({ brief_prefs: { world: { title: 'My world' } } }, 'world')).toBe('My world')
    expect(briefTitle({}, 'ibkr')).toBe('Morning brief')
    expect(briefTitle({}, 'ibkr', { forSettings: true })).toBe('IBKR morning brief')
    expect(briefPrefs({ brief_prefs: { jobs: { max: 12 } } }, 'jobs').max).toBe(12)
  })
})

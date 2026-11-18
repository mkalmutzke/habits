import { describe, expect, it } from 'vitest'
import { agenda, calendarAddress, dayHeading, lastRead } from './calendar.js'

// the unit tests run in the Europe/Zurich time zone (vite.config.js)
const TODAY = '2026-11-18'
const sources = [
  { id: 'work', name: 'Work', color: 'sky', enabled: true },
  { id: 'fam', name: 'Family', color: 'green', enabled: true },
  { id: 'off', name: 'Old', color: 'rose', enabled: false },
]
const timed = (id, source, startsAt, endsAt, title) => ({ id, source_id: source, all_day: false, starts_at: startsAt, ends_at: endsAt, title, location: '' })
const allDay = (id, source, start, end, title) => ({ id, source_id: source, all_day: true, start_day: start, end_day: end, title, location: '' })

describe('calendar agenda (v3.9)', () => {
  it('seven days, timed events on their local day in order, all-day first', () => {
    const days = agenda(
      [
        timed('b', 'fam', '2026-11-18T17:00:00Z', '2026-11-18T18:00:00Z', 'Dog school'),
        timed('a', 'work', '2026-11-18T08:30:00Z', '2026-11-18T09:00:00Z', 'Stand-up'),
        allDay('c', 'fam', '2026-11-18', '2026-11-19', 'Birthday'),
        // 23:30 UTC on the 18th is already the 19th in Zurich
        timed('d', 'work', '2026-11-18T23:30:00Z', '2026-11-19T00:30:00Z', 'Late call'),
      ],
      sources,
      TODAY,
    )
    expect(days).toHaveLength(7)
    expect(days[0].events.map((e) => [e.title, e.time ?? 'all day'])).toEqual([
      ['Birthday', 'all day'],
      ['Stand-up', '09:30'],
      ['Dog school', '18:00'],
    ])
    expect(days[1].events.map((e) => e.title)).toEqual(['Late call'])
    expect(days[0].events[1]).toMatchObject({ end: '10:00', color: 'sky', calendar: 'Work' })
  })

  it('an all-day event over several days shows on each; switched-off calendars and far events are left out', () => {
    const days = agenda([allDay('t', 'work', '2026-11-16', '2026-11-20', 'Trip'), allDay('x', 'off', '2026-11-18', '2026-11-19', 'Hidden'), timed('f', 'work', '2026-11-30T08:00:00Z', '2026-11-30T09:00:00Z', 'Later')], sources, TODAY)
    expect(days.map((d) => d.events.map((e) => e.title).join())).toEqual(['Trip', 'Trip', '', '', '', '', ''])
  })

  it('day headings and the last read', () => {
    expect(dayHeading('2026-11-18', TODAY)).toBe('Today · Wed 18 Nov')
    expect(dayHeading('2026-11-19', TODAY)).toBe('Tomorrow · Thu 19 Nov')
    expect(dayHeading('2026-11-21', TODAY)).toBe('Sat 21 Nov')
    expect(lastRead([{ last_sync_at: '2026-11-18T07:15:00Z' }, { last_sync_at: null }, { last_sync_at: '2026-11-18T08:15:00Z' }])).toBe('2026-11-18T08:15:00Z')
    expect(lastRead([])).toBe(null)
  })

  it('accepts only addresses the server will fetch', () => {
    expect(calendarAddress('webcal://p42-caldav.icloud.com/published/2/abc')).toBe('https://p42-caldav.icloud.com/published/2/abc')
    expect(calendarAddress('http://example.com/a.ics')).toBe(null)
  })
})

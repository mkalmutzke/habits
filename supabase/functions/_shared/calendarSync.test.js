import { describe, expect, it } from 'vitest'
import { safeCalendarUrl, syncErrorText, toRows, windowFor } from './calendarSync.js'

describe('calendar-sync helpers (v3.9)', () => {
  it('accepts the usual calendar addresses, webcal as https', () => {
    expect(safeCalendarUrl(' https://calendar.google.com/calendar/ical/a%40gmail.com/private-x/basic.ics ')).toBe('https://calendar.google.com/calendar/ical/a%40gmail.com/private-x/basic.ics')
    expect(safeCalendarUrl('webcal://p42-caldav.icloud.com/published/2/abc')).toBe('https://p42-caldav.icloud.com/published/2/abc')
    expect(safeCalendarUrl('https://outlook.office365.com/owa/calendar/x/y/calendar.ics')).toMatch(/^https:\/\/outlook/)
  })

  it('refuses anything that could reach the server itself or a private network', () => {
    for (const bad of ['http://calendar.google.com/a.ics', 'https://localhost/a.ics', 'https://127.0.0.1/a.ics', 'https://[::1]/a.ics', 'https://10.0.0.5/a.ics', 'https://intranet/a.ics', 'https://db.internal/a.ics', 'https://printer.local/a.ics', 'https://user:pw@example.com/a.ics', 'https://example.com:8443/a.ics', 'file:///etc/passwd', 'not a url', null]) {
      expect(safeCalendarUrl(bad)).toBe(null)
    }
  })

  it('keeps yesterday to 15 days ahead in the user’s time zone', () => {
    const window = windowFor('2026-11-18', 'Europe/Zurich')
    expect(new Date(window.fromMs).toISOString()).toBe('2026-11-16T23:00:00.000Z')
    expect(new Date(window.toMs).toISOString()).toBe('2026-12-02T23:00:00.000Z')
    expect(new Date(windowFor('2026-12-01', 'UTC').fromMs).toISOString()).toBe('2026-11-30T00:00:00.000Z')
  })

  it('turns events into database rows', () => {
    expect(toRows([{ uid: 'a', allDay: true, startDay: '2026-11-18', endDay: '2026-11-19', title: 'B', location: '', link: '' }])).toEqual([{ uid: 'a', all_day: true, start_day: '2026-11-18', end_day: '2026-11-19', title: 'B', location: '', link: '' }])
    expect(toRows([{ uid: 'b', allDay: false, startsAt: 'x', endsAt: 'y', title: 'T', location: 'L', link: '' }])[0]).toMatchObject({ all_day: false, starts_at: 'x', ends_at: 'y' })
  })

  it('explains a failed read in plain words', () => {
    expect(syncErrorText(new Error('HTTP 404'))).toMatch(/No calendar at this address/)
    expect(syncErrorText(new Error('not an iCal file'))).toMatch(/secret address in iCal format/)
    expect(syncErrorText(new Error('The signal has been aborted'))).toMatch(/didn’t answer in time/)
  })
})

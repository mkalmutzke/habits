import { describe, expect, it } from 'vitest'
import { eventsInWindow, knownZone, parseDuration, unfold, zonedToUtc } from './ical.js'

// A small calendar file around the given VEVENT blocks.
const ics = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', 'X-WR-TIMEZONE:Europe/Zurich', ...events.flat(), 'END:VCALENDAR'].join('\r\n')
const vevent = (...lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']
// Window: Wed 18 Nov 2026 00:00 to Wed 2 Dec 2026 00:00, Zurich time
const window = { fromMs: Date.parse('2026-11-17T23:00:00Z'), toMs: Date.parse('2026-12-01T23:00:00Z'), zone: 'Europe/Zurich' }

describe('iCal basics (v3.9)', () => {
  it('joins folded lines and reads durations', () => {
    expect(unfold('SUMMARY:Long\r\n  title\r\nEND:VEVENT')).toEqual(['SUMMARY:Long title', 'END:VEVENT'])
    expect(parseDuration('PT1H30M')).toBe(5_400_000)
    expect(parseDuration('P1W')).toBe(7 * 86_400_000)
    expect(parseDuration('-PT15M')).toBe(-900_000)
  })

  it('knows IANA and common Windows zone names', () => {
    expect(knownZone('Europe/Zurich')).toBe('Europe/Zurich')
    expect(knownZone('W. Europe Standard Time')).toBe('Europe/Berlin')
    expect(knownZone('Not/AZone')).toBe(null)
  })

  it('converts wall-clock times across summer and winter time', () => {
    expect(new Date(zonedToUtc({ year: 2026, month: 10, day: 19, hour: 9 }, 'Europe/Zurich')).toISOString()).toBe('2026-10-19T07:00:00.000Z')
    expect(new Date(zonedToUtc({ year: 2026, month: 10, day: 26, hour: 9 }, 'Europe/Zurich')).toISOString()).toBe('2026-10-26T08:00:00.000Z')
    expect(new Date(zonedToUtc({ year: 2026, month: 11, day: 18, hour: 9 }, 'America/Toronto')).toISOString()).toBe('2026-11-18T14:00:00.000Z')
  })

  it('refuses something that is not an iCal file', () => {
    expect(() => eventsInWindow('<html>Sign in</html>', window)).toThrow('not an iCal file')
  })
})

describe('events in the window (v3.9)', () => {
  it('timed events in a named zone, in UTC and floating; escaped text', () => {
    const events = eventsInWindow(
      ics(
        vevent('UID:a', 'DTSTART;TZID=Europe/Zurich:20261118T093000', 'DTEND;TZID=Europe/Zurich:20261118T100000', 'SUMMARY:Stand-up\\, SAC migration', 'LOCATION:Teams'),
        vevent('UID:b', 'DTSTART:20261119T170000Z', 'DURATION:PT1H', 'SUMMARY:Interview – Toronto'),
        vevent('UID:c', 'DTSTART:20261120T074500', 'SUMMARY:Vet check-up'),
        vevent('UID:old', 'DTSTART:20261101T100000Z', 'SUMMARY:Too early'),
      ),
      window,
    )
    expect(events.map((e) => [e.uid, e.title, e.startsAt])).toEqual([
      ['a', 'Stand-up, SAC migration', '2026-11-18T08:30:00.000Z'],
      ['b', 'Interview – Toronto', '2026-11-19T17:00:00.000Z'],
      ['c', 'Vet check-up', '2026-11-20T06:45:00.000Z'],
    ])
    expect(events[0]).toMatchObject({ location: 'Teams', endsAt: '2026-11-18T09:00:00.000Z', allDay: false })
    expect(events[1].endsAt).toBe('2026-11-19T18:00:00.000Z')
  })

  it('all-day events, also over several days and from Outlook', () => {
    const events = eventsInWindow(
      ics(
        vevent('UID:bday', 'DTSTART;VALUE=DATE:20261118', 'DTEND;VALUE=DATE:20261119', 'SUMMARY:Lisa’s birthday'),
        vevent('UID:trip', 'DTSTART;VALUE=DATE:20261116', 'DTEND;VALUE=DATE:20261121', 'SUMMARY:Trip'),
        vevent('UID:ol', 'DTSTART;TZID=W. Europe Standard Time:20261124T140000', 'DTEND;TZID=W. Europe Standard Time:20261124T150000', 'SUMMARY:Outlook call'),
      ),
      window,
    )
    expect(events.find((e) => e.uid === 'bday')).toMatchObject({ allDay: true, startDay: '2026-11-18', endDay: '2026-11-19' })
    // started before the window, still running: kept
    expect(events.find((e) => e.uid === 'trip')).toMatchObject({ startDay: '2026-11-16', endDay: '2026-11-21' })
    expect(events.find((e) => e.uid === 'ol').startsAt).toBe('2026-11-24T13:00:00.000Z')
  })

  it('weekly repeats with BYDAY, EXDATE, a moved date and a cancelled date', () => {
    const events = eventsInWindow(
      ics(
        vevent('UID:gym', 'DTSTART;TZID=Europe/Zurich:20261005T180000', 'DTEND;TZID=Europe/Zurich:20261005T190000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TH', 'EXDATE;TZID=Europe/Zurich:20261119T180000', 'SUMMARY:Gym'),
        vevent('UID:gym', 'RECURRENCE-ID;TZID=Europe/Zurich:20261123T180000', 'DTSTART;TZID=Europe/Zurich:20261123T200000', 'DTEND;TZID=Europe/Zurich:20261123T210000', 'SUMMARY:Gym (late)'),
        vevent('UID:gym', 'RECURRENCE-ID;TZID=Europe/Zurich:20261126T180000', 'DTSTART;TZID=Europe/Zurich:20261126T180000', 'STATUS:CANCELLED', 'SUMMARY:Gym'),
      ),
      window,
    )
    expect(events.map((e) => `${e.title} ${e.startsAt}`)).toEqual([
      'Gym (late) 2026-11-23T19:00:00.000Z',
      'Gym 2026-11-30T17:00:00.000Z',
    ])
  })

  it('a weekly repeat keeps its wall-clock time after the change to winter time', () => {
    const events = eventsInWindow(ics(vevent('UID:w', 'DTSTART;TZID=Europe/Zurich:20260921T090000', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Team')), window)
    expect(events.map((e) => e.startsAt)).toEqual(['2026-11-23T08:00:00.000Z', '2026-11-30T08:00:00.000Z'])
  })

  it('daily with COUNT and UNTIL, monthly last Friday, yearly birthday', () => {
    const events = eventsInWindow(
      ics(
        vevent('UID:d', 'DTSTART;VALUE=DATE:20261116', 'RRULE:FREQ=DAILY;COUNT=5', 'SUMMARY:Course'),
        vevent('UID:u', 'DTSTART:20261118T060000Z', 'RRULE:FREQ=DAILY;INTERVAL=2;UNTIL=20261122T235959Z', 'SUMMARY:Run'),
        vevent('UID:m', 'DTSTART;TZID=Europe/Zurich:20260130T160000', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR', 'SUMMARY:Payday drinks'),
        vevent('UID:y', 'DTSTART;VALUE=DATE:19900325', 'RRULE:FREQ=YEARLY', 'SUMMARY:Old birthday'),
        vevent('UID:y2', 'DTSTART;VALUE=DATE:19851125', 'RRULE:FREQ=YEARLY', 'SUMMARY:Mum’s birthday'),
      ),
      window,
    )
    expect(events.filter((e) => e.uid === 'd').map((e) => e.startDay)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20'])
    expect(events.filter((e) => e.uid === 'u').map((e) => e.startsAt.slice(0, 10))).toEqual(['2026-11-18', '2026-11-20', '2026-11-22'])
    expect(events.filter((e) => e.uid === 'm').map((e) => e.startsAt)).toEqual(['2026-11-27T15:00:00.000Z'])
    expect(events.filter((e) => e.uid.startsWith('y')).map((e) => `${e.title} ${e.startDay}`)).toEqual(['Mum’s birthday 2026-11-25'])
  })

  it('cancelled events are left out; the list is capped and sorted', () => {
    const many = Array.from({ length: 30 }, (_, i) => vevent(`UID:n${i}`, `DTSTART:202611${String(18 + (i % 10)).padStart(2, '0')}T${String(10 + (i % 5)).padStart(2, '0')}0000Z`, `SUMMARY:E${i}`))
    const events = eventsInWindow(ics(...many, vevent('UID:x', 'DTSTART:20261118T080000Z', 'STATUS:CANCELLED', 'SUMMARY:Off')), { ...window, limit: 10 })
    expect(events).toHaveLength(10)
    expect(events.some((e) => e.title === 'Off')).toBe(false)
    expect([...events].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))).toEqual(events)
  })
})

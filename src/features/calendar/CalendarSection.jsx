import { useOnline } from '../../shared/data/hooks.js'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'
import Icon from '../../shared/ui/Icon.jsx'
import { useToast } from '../../shared/ui/toast.js'
import { toTimeKey } from '../../shared/utils/date.js'
import { agenda, dayHeading, lastRead } from './calendar.js'
import './calendar.css'

// v3.9 (owner): "Calendar" on Dawn – today and the next 6 days from the
// user's calendars (Settings → Calendars), each in its colour. Open at app
// start; Refresh reads the calendars now (they are also read every 15
// minutes). Read-only: events are changed in the calendar app itself.
function CalendarSection({ calendars, today }) {
  const online = useOnline()
  const toast = useToast()
  const section = useSectionOpen('calendar', true)
  const { sources, events, loading, refresh, refreshing } = calendars
  const days = agenda(events, sources, today)
  const todayCount = days[0].events.length
  const failing = sources.filter((source) => source.enabled && source.last_error)
  const read = lastRead(sources)
  const nothing = days.every((day) => day.events.length === 0)

  async function handleRefresh() {
    const result = await refresh()
    toast.show(result.message, result.ok ? {} : { tone: 'error' })
  }

  return (
    <CollapsibleSection
      state={section}
      className="calendar-section"
      title="Calendar"
      summary={sources.length === 0 ? (loading ? null : 'no calendar yet') : `${todayCount} today`}
      actions={
        sources.length > 0 && (
          <button type="button" className="section-icon-button" aria-label="Refresh calendars" onClick={handleRefresh} disabled={!online || refreshing} aria-busy={refreshing}>
            <Icon name="refresh" className={refreshing ? 'spinning' : undefined} />
          </button>
        )
      }
    >
      {sources.length === 0 ? (
        <p className="empty-note">
          {loading ? 'Loading…' : (
            <>
              No calendar yet. Add one in <a href="#/settings">Settings → Calendars</a> with its secret iCal address (Google, iCloud, Outlook…).
            </>
          )}
        </p>
      ) : (
        <>
          {failing.length > 0 && (
            <p className="calendar-warning" role="status">
              {failing.map((source) => source.name).join(', ')} couldn’t be read – <a href="#/settings">see Settings → Calendars</a>.
            </p>
          )}
          {nothing ? (
            <p className="empty-note">Nothing planned for the next 7 days.</p>
          ) : (
            days.map((day, index) =>
              day.events.length === 0 && index > 0 ? null : (
                <section key={day.day} className="calendar-day" aria-label={dayHeading(day.day, today)}>
                  <h3 className={index === 0 ? 'calendar-day-head is-today' : 'calendar-day-head'}>{dayHeading(day.day, today)}</h3>
                  {day.events.length === 0 ? (
                    <p className="calendar-free">Nothing planned</p>
                  ) : (
                    <ul className="calendar-events">
                      {day.events.map((event) => (
                        <li key={event.id} className={`calendar-event color-${event.color}`}>
                          <span className="calendar-time">{event.allDay ? 'all day' : event.time}</span>
                          <span className="calendar-bar" aria-hidden="true" />
                          <span className="calendar-text">
                            <span className="calendar-title">{event.title}</span>
                            <span className="calendar-meta">
                              {event.calendar}
                              {event.location ? ` · ${event.location}` : ''}
                              {!event.allDay && event.end !== event.time ? ` · until ${event.end}` : ''}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ),
            )
          )}
          {read && <p className="calendar-stamp">Read {toTimeKey(new Date(read))} · again every 15 minutes</p>}
        </>
      )}
    </CollapsibleSection>
  )
}

export default CalendarSection

import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'
import { fetchedLabel, formatCount, formatDuration, headerSummary, isStale, lastFetched, monthLabel, summarize, viewDays } from './garmin.js'
import { DayRow, MonthGrid } from './GarminDays.jsx'
import './garmin.css'

// "Garmin" on the Week page (v3.5): a
// foldable card in place of Habits, folded at every app start. The header
// shows the 7-day averages (owner G3); opened, a toggle switches between the
// Week page's 7 days and the calendar month so far (G10). The toggle keeps its
// choice until the app is closed, like the IBKR eye.
function GarminSection({ garmin, today }) {
  const section = useSectionOpen('garmin')
  const [showMonth, setShowMonth] = useSectionOpen('garmin-month')
  const { days, activities, loading } = garmin
  const week = summarize(days, activities, viewDays('week', today))
  const hasData = days.length > 0

  return (
    <CollapsibleSection
      state={section}
      className="garmin-section"
      title="Garmin"
      summary={hasData ? headerSummary(week) : loading ? null : 'not set up yet'}
    >
      {hasData ? (
        <GarminBody days={days} activities={activities} week={week} showMonth={showMonth} setShowMonth={setShowMonth} today={today} />
      ) : (
        <p className="empty-note">
          {loading ? 'Loading…' : 'No data from Garmin yet. It appears within half an hour once the personal Garmin key is entered in the Supabase dashboard.'}
        </p>
      )}
    </CollapsibleSection>
  )
}

function GarminBody({ days, activities, week, showMonth, setShowMonth, today }) {
  const monthDays = viewDays('month', today)
  const view = showMonth ? summarize(days, activities, monthDays) : week
  const fetchedAt = lastFetched(days)
  const stale = isStale(fetchedAt)

  return (
    <>
      <div className="garmin-toolbar">
        {showMonth && <span className="garmin-range">{monthLabel(monthDays)}</span>}
        <div className="garmin-toggle" role="group" aria-label="Period">
          <button type="button" aria-pressed={!showMonth} onClick={() => setShowMonth(false)}>
            7 days
          </button>
          <button type="button" aria-pressed={showMonth} onClick={() => setShowMonth(true)}>
            Month
          </button>
        </div>
      </div>

      <div className="garmin-block">
        <p className="garmin-label">
          <span>Steps</span>
          <span>average per day{showMonth ? ' · in thousands' : ''}</span>
        </p>
        <p className="garmin-big">{formatCount(view.stepsAverage)}</p>
        {showMonth ? <MonthGrid perDay={view.perDay} today={today} /> : <DayRow perDay={view.perDay} value={(row) => formatCount(row.steps)} today={today} />}
      </div>

      <div className="garmin-block">
        <p className="garmin-label">
          <span>Resting heart rate</span>
          <span>average</span>
        </p>
        <p className="garmin-big">
          {view.restingHrAverage ?? '–'}
          <small>bpm</small>
        </p>
        {/* the month view shows only the average (owner G11) */}
        {!showMonth && <DayRow perDay={view.perDay} value={(row) => row.restingHr ?? '–'} today={today} />}
      </div>

      <div className="garmin-block">
        <p className="garmin-label">
          <span>Activities</span>
          <span>moving time</span>
        </p>
        {view.activities.length ? (
          <table className="garmin-activities">
            <tbody>
              {view.activities.map((group) => (
                <tr key={group.label}>
                  <th scope="row">
                    <span className="garmin-icon" aria-hidden="true">
                      {group.icon}
                    </span>
                    {group.label}
                  </th>
                  <td>{group.count}×</td>
                  <td>{formatDuration(group.seconds)}</td>
                </tr>
              ))}
              <tr className="garmin-total">
                <th scope="row">Total</th>
                <td>{view.total.count}×</td>
                <td>{formatDuration(view.total.seconds)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="empty-note">No activities {showMonth ? 'this month' : 'in these 7 days'}.</p>
        )}
      </div>

      <p className={stale ? 'garmin-stamp stale' : 'garmin-stamp'}>
        {stale
          ? `No new data from Garmin since ${fetchedLabel(fetchedAt, today)}. If your watch has synced, the Garmin key may have expired.`
          : `Last data ${fetchedLabel(fetchedAt, today)} · Garmin Connect`}
      </p>
    </>
  )
}

export default GarminSection

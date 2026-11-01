import { useOnline } from '../../shared/data/hooks.js'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import Icon from '../../shared/ui/Icon.jsx'
import Modal from '../../shared/ui/Modal.jsx'
import { useToast } from '../../shared/ui/toast.js'
import {
  fetchedLabel,
  formatCount,
  formatDistance,
  formatDuration,
  headerSummary,
  isStale,
  lastFetched,
  monthLabel,
  summarize,
  viewDays,
} from './garmin.js'
import { DayRow, MonthGrid, StepsChart } from './GarminDays.jsx'
import './garmin.css'

// "Garmin" (v3.6, owner): opened from the running-figure icon in the header
// of the three main pages – no longer a card on the Week page. The small line
// under the title shows the 7-day averages; a toggle switches between the
// last 7 days and the calendar month (kept until the app is closed). Refresh
// fetches new data now (at most once per 2 minutes); the automatic fetch
// every 30 minutes stays as it is.
function GarminWindow({ garmin, today, onClose }) {
  const online = useOnline()
  const toast = useToast()
  const [showMonth, setShowMonth] = useSectionOpen('garmin-month')
  const { days, activities, loading, refresh, refreshing } = garmin
  const week = summarize(days, activities, viewDays('week', today))
  const hasData = days.length > 0

  async function handleRefresh() {
    const result = await refresh()
    toast.show(result.message, result.ok ? {} : { tone: 'error' })
  }

  return (
    <Modal
      open
      wide
      className="garmin-window"
      onClose={onClose}
      title="Garmin"
      subtitle={hasData ? `7 days: ${headerSummary(week)}` : null}
      headerActions={
        <button type="button" className="garmin-refresh" onClick={handleRefresh} disabled={!online || refreshing} aria-busy={refreshing}>
          <Icon name="refresh" className={refreshing ? 'spinning' : undefined} />
          Refresh
        </button>
      }
    >
      {hasData ? (
        <GarminBody days={days} activities={activities} week={week} showMonth={showMonth} setShowMonth={setShowMonth} today={today} />
      ) : (
        <p className="empty-note">
          {loading ? 'Loading…' : 'No data from Garmin yet. It appears within half an hour once the personal Garmin key is entered in the Supabase dashboard.'}
        </p>
      )}
    </Modal>
  )
}

function GarminBody({ days, activities, week, showMonth, setShowMonth, today }) {
  const monthDays = viewDays('month', today)
  const view = showMonth ? summarize(days, activities, monthDays) : week
  const fetchedAt = lastFetched(days)
  const stale = isStale(fetchedAt)

  return (
    <div className="garmin-body">
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
          <span>average per day · in thousands</span>
        </p>
        <p className="garmin-big">{formatCount(view.stepsAverage)}</p>
        {/* v3.6 (owner): the 7 days as a bar chart */}
        {showMonth ? <MonthGrid perDay={view.perDay} today={today} /> : <StepsChart perDay={view.perDay} average={view.stepsAverage} today={today} />}
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
        </p>
        {view.activities.length ? (
          <table className="garmin-activities">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Count</th>
                <th scope="col">Distance</th>
                <th scope="col">Moving</th>
              </tr>
            </thead>
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
                  <td>{formatDistance(group.meters)}</td>
                  <td>{formatDuration(group.seconds)}</td>
                </tr>
              ))}
              <tr className="garmin-total">
                <th scope="row">Total</th>
                <td>{view.total.count}×</td>
                <td>{formatDistance(view.total.meters)}</td>
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
          : `Last data ${fetchedLabel(fetchedAt, today)} · Garmin Connect · also refreshes by itself every 30 minutes`}
      </p>
    </div>
  )
}

export default GarminWindow

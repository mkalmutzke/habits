import { formatShortDate } from '../../shared/utils/date.js'
import { barHeights, dayName, formatCount, formatThousands, leadingBlanks } from './garmin.js'

// The Garmin card's day displays (v3.5): seven numbers for the week view, and
// the month's steps as calendar cells.

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
// the month grid's shade: a cell is fully coloured at this many steps
const FULL_SHADE_STEPS = 15000

// Seven numbers with their day below; today in amber (it is still running).
export function DayRow({ perDay, value, today }) {
  return (
    <ol className="garmin-days">
      {perDay.map((row) => (
        <li key={row.day} className={row.day === today ? 'today' : undefined}>
          <span className="garmin-value">{value(row)}</span>
          <span className="garmin-day">{dayName(row.day, today)}</span>
        </li>
      ))}
    </ol>
  )
}

// v3.6 (owner): the 7 days' steps as a bar chart – value (in thousands) on
// top, day below, today in amber, a dashed line at the average. Screen
// readers get the same as a list: day and steps.
export function StepsChart({ perDay, average, today }) {
  const heights = barHeights(perDay)
  const highest = Math.max(0, ...perDay.map((row) => row.steps ?? 0))
  const averageAt = highest > 0 && average ? average / highest : null
  return (
    <div className="garmin-chart">
      <ol className="garmin-bars" aria-label="Steps per day, last 7 days" style={{ '--average': averageAt ?? 0 }}>
        {averageAt !== null && <li className="garmin-average" aria-hidden="true" />}
        {perDay.map((row, index) => (
          <li key={row.day} className={row.day === today ? 'today' : undefined}>
            <span className="garmin-bar-value" aria-hidden="true">
              {formatThousands(row.steps)}
            </span>
            <span className="garmin-bar" style={{ '--height': heights[index] }} aria-hidden="true" />
            <span className="garmin-day">{dayName(row.day, today)}</span>
            <span className="visually-hidden">: {formatCount(row.steps)} steps</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// The month's steps as calendar cells, Monday to Sunday per row.
export function MonthGrid({ perDay, today }) {
  const blanks = leadingBlanks(perDay.map((row) => row.day))
  return (
    <div className="garmin-month">
      <div className="garmin-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <ol className="garmin-cells" aria-label="Steps per day this month">
        {Array.from({ length: blanks }, (_, index) => (
          <li key={`blank-${index}`} className="garmin-cell blank" aria-hidden="true" />
        ))}
        {perDay.map((row) => (
          <li
            key={row.day}
            className={row.day === today ? 'garmin-cell today' : 'garmin-cell'}
            style={{ '--shade': row.steps === null ? 0 : Math.min(1, row.steps / FULL_SHADE_STEPS) }}
          >
            <span aria-hidden="true">{formatThousands(row.steps)}</span>
            <span className="visually-hidden">
              {formatShortDate(row.day)}: {formatCount(row.steps)} steps
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

import { formatShortDate } from '../../shared/utils/date.js'
import { barHeights, dayName, formatClimb, formatCount, formatThousands, leadingBlanks } from './garmin.js'

// The Garmin card's day displays (v3.5): seven numbers for the week view, and
// the month's steps (v3.7: and elevation) as calendar cells.

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
// the month grid's shade: a cell is fully coloured at this many steps
const FULL_SHADE_STEPS = 15000
// v3.7: … and the elevation grid at this many metres climbed
const FULL_SHADE_METRES = 1000

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

// The month's days as calendar cells, Monday to Sunday per row. Steps by
// default; v3.7: the same grid shows the daily elevation (`kind="elevation"`).
const MONTH_KINDS = {
  steps: {
    label: 'Steps per day this month',
    value: (row) => row.steps,
    cell: formatThousands,
    spoken: (row) => `${formatCount(row.steps)} steps`,
    full: FULL_SHADE_STEPS,
  },
  elevation: {
    label: 'Elevation per day this month',
    value: (row) => row.elevation,
    cell: formatClimb,
    spoken: (row) => (row.elevation === null ? 'no activity' : `${formatCount(row.elevation)} m climbed`),
    full: FULL_SHADE_METRES,
  },
}

export function MonthGrid({ perDay, today, kind = 'steps' }) {
  const { label, value, cell, spoken, full } = MONTH_KINDS[kind]
  const blanks = leadingBlanks(perDay.map((row) => row.day))
  return (
    <div className={`garmin-month ${kind}`}>
      <div className="garmin-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <ol className="garmin-cells" aria-label={label}>
        {Array.from({ length: blanks }, (_, index) => (
          <li key={`blank-${index}`} className="garmin-cell blank" aria-hidden="true" />
        ))}
        {perDay.map((row) => (
          <li
            key={row.day}
            className={row.day === today ? 'garmin-cell today' : 'garmin-cell'}
            style={{ '--shade': value(row) === null ? 0 : Math.min(1, value(row) / full) }}
          >
            <span aria-hidden="true">{cell(value(row))}</span>
            <span className="visually-hidden">
              {formatShortDate(row.day)}: {spoken(row)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

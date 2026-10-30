import { useEffect, useState } from 'react'
import { useDragReorder } from '../../shared/hooks/useDragReorder.js'
import { formatShortDate, formatWeekday } from '../../shared/utils/date.js'
import { getRollingDays } from '../week/week.js'
import { getMilestone, getStreak } from './streak.js'
import './habits.css'

const POP_MS = 450
// v3.1 (owner): only the last 4 days are shown, so title and subtitle get
// enough room next to the dots.
const SHOWN_DAYS = 4

// One row per habit: icon + title, an optional subtitle below it, one
// tappable dot per shown day (tap = tick, tap again = untick), and on the
// right the streak – days in a row, not limited to a week – with a flame,
// from 2 days in a row (owner, v3.1.1).
// The habit's text opens its dialog. Used on What's up? and Week alike.
// v3.3 (§3.2): with `onMove(from, to)` every row starts with a grip to
// reorder the habits by drag and drop or with the keyboard.
function HabitWeekGrid({ habits, today, onToggle, onEdit, onMove, disabled = false, label = 'Habits, last days' }) {
  const days = getRollingDays(today).slice(-SHOWN_DAYS)
  const sortable = Boolean(onMove)
  const { containerRef, drag, announcement, gripProps, rowStyle } = useDragReorder({ count: habits.length, onMove: onMove ?? (() => {}), nameOf: (index) => habits[index]?.name ?? '' })
  // the dot that was just ticked plays a short "pop"
  const [popped, setPopped] = useState(null)

  useEffect(() => {
    if (!popped) return
    const timer = setTimeout(() => setPopped(null), POP_MS)
    return () => clearTimeout(timer)
  }, [popped])

  function handleTick(habit, day, event) {
    const done = habit.completions.includes(day)
    if (!done) setPopped(`${habit.id}:${day}`)
    const rect = event.currentTarget.getBoundingClientRect()
    onToggle(habit, day, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }

  return (
    <>
      <div ref={containerRef} className={sortable ? 'week-grid-v3 sortable' : 'week-grid-v3'} role="table" aria-label={label}>
        <div className="wg-row wg-head" role="row">
          {sortable && (
            <span role="columnheader">
              <span className="visually-hidden">Order</span>
            </span>
          )}
          <span role="columnheader">
            <span className="visually-hidden">Habit</span>
          </span>
          {days.map((day) => (
            <span key={day} role="columnheader" className={day === today ? 'wg-day-head is-today' : 'wg-day-head'}>
              <abbr title={`${formatWeekday(day)} ${formatShortDate(day)}`}>{formatWeekday(day).slice(0, 2)}</abbr>
              <br />
              {Number(day.slice(8))}
            </span>
          ))}
          <span role="columnheader" className="wg-day-head">
            <span className="visually-hidden">Days in a row</span>
          </span>
        </div>

        {habits.map((habit, index) => {
          const streak = getStreak(habit.completions, today)
          const name = habit.subtitle ? `${habit.name} – ${habit.subtitle}` : habit.name
          const lifted = drag?.from === index
          return (
            <div
              key={habit.id}
              className={lifted ? 'wg-row is-lifted' : drag ? 'wg-row is-shifting' : 'wg-row'}
              role="row"
              data-reorder-row=""
              style={sortable ? rowStyle(index) : undefined}
            >
              {sortable && (
                <span role="cell" className="wg-grip-cell">
                  <button
                    type="button"
                    className="wg-grip"
                    aria-label={`Move ${habit.name}`}
                    disabled={disabled || habits.length < 2}
                    {...gripProps(index)}
                  >
                    <svg viewBox="0 0 14 18" aria-hidden="true">
                      <circle cx="4" cy="3" r="1.6" />
                      <circle cx="10" cy="3" r="1.6" />
                      <circle cx="4" cy="9" r="1.6" />
                      <circle cx="10" cy="9" r="1.6" />
                      <circle cx="4" cy="15" r="1.6" />
                      <circle cx="10" cy="15" r="1.6" />
                    </svg>
                  </button>
                </span>
              )}
              <span role="rowheader" className="wg-head-cell">
                {onEdit ? (
                  <button type="button" className="wg-habit" onClick={() => onEdit(habit)} aria-label={`${name} – edit`}>
                    <HabitLabel habit={habit} />
                  </button>
                ) : (
                  <span className="wg-habit">
                    <HabitLabel habit={habit} />
                  </span>
                )}
              </span>
              {days.map((day) => {
                const done = habit.completions.includes(day)
                const classes = ['wg-cell', done && 'done', day === today && 'is-today', popped === `${habit.id}:${day}` && 'pop']
                return (
                  <span key={day} role="cell">
                    <button
                      type="button"
                      className={classes.filter(Boolean).join(' ')}
                      aria-pressed={done}
                      aria-label={`${habit.name}, ${formatWeekday(day)} ${formatShortDate(day)}: ${done ? 'done – tap to undo' : 'not done – tap to tick'}`}
                      disabled={disabled}
                      onClick={(event) => handleTick(habit, day, event)}
                    >
                      <span className="wg-dot" />
                    </button>
                  </span>
                )
              })}
              <span role="cell" className="wg-count">
                {streak >= 2 && (
                  <span className={`wg-flame tier-${getMilestone(streak)}`} aria-label={`${streak} days in a row`}>
                    {streak} 🔥
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {sortable && (
        <p className="visually-hidden" role="status">
          {announcement}
        </p>
      )}
    </>
  )
}

function HabitLabel({ habit }) {
  return (
    <>
      <span className="wg-name">
        <span aria-hidden="true">{habit.emoji} </span>
        {habit.name}
      </span>
      {habit.subtitle && <span className="wg-subtitle">{habit.subtitle}</span>}
    </>
  )
}

export default HabitWeekGrid

import { useEffect, useState } from 'react'
import { useDragReorder } from '../../shared/hooks/useDragReorder.js'
import { formatShortDate, formatWeekday } from '../../shared/utils/date.js'
import { getRollingDays } from '../week/week.js'
import { dayStatus, nextStatus } from './habitData.js'
import { getMilestone, getStreak, isOnBreak } from './streak.js'
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
// v3.8 (owner): a dot has three states – tap = done, tap again = break (a
// violet ring with a pause sign; keeps the streak), tap again = nothing.
// While a habit is on a break, its streak shows a pause sign instead of the flame.
function HabitWeekGrid({ habits, today, onToggle, onEdit, onMove, breakLimit = null, disabled = false, label = 'Habits, last days' }) {
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
    if (dayStatus(habit, day) === null) setPopped(`${habit.id}:${day}`)
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
          const streak = getStreak(habit.completions, today, habit.breaks)
          const resting = isOnBreak(habit.completions, today, habit.breaks)
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
                const status = dayStatus(habit, day)
                const classes = ['wg-cell', status === 'done' && 'done', status === 'break' && 'break', day === today && 'is-today', popped === `${habit.id}:${day}` && 'pop']
                return (
                  <span key={day} role="cell">
                    <button
                      type="button"
                      className={classes.filter(Boolean).join(' ')}
                      aria-pressed={status === 'done' ? true : status === 'break' ? 'mixed' : false}
                      aria-label={`${habit.name}, ${formatWeekday(day)} ${formatShortDate(day)}: ${dayLabel(status, nextStatus(habit, day, breakLimit))}`}
                      disabled={disabled}
                      onClick={(event) => handleTick(habit, day, event)}
                    >
                      <span className="wg-dot" />
                    </button>
                  </span>
                )
              })}
              <span role="cell" className="wg-count">
                {streak >= 2 && !resting && (
                  <span className={`wg-flame tier-${getMilestone(streak)}`} aria-label={`${streak} days in a row`}>
                    {streak} 🔥
                  </span>
                )}
                {streak >= 1 && resting && (
                  <span className="wg-flame on-break" aria-label={`${streak} ${streak === 1 ? 'day' : 'days'} in a row, on a break`}>
                    {streak} <span aria-hidden="true">‖</span>
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

// What the dot's label says: its state, then what a tap does (v3.8).
function dayLabel(status, next) {
  const now = status === 'done' ? 'done' : status === 'break' ? 'on a break' : 'not done'
  const tap = next === 'done' ? 'tap to tick' : next === 'break' ? 'tap for a break' : 'tap to clear'
  return `${now} – ${tap}`
}

export default HabitWeekGrid

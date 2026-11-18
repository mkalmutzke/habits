import { useState } from 'react'
import { formatMonth, formatShortDate, formatWeekday } from '../../shared/utils/date.js'
import Modal from '../../shared/ui/Modal.jsx'
import { dayStatus, groupHabits } from './habitData.js'
import { monthOverview, monthStart } from './monthOverview.js'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const STATE_TEXT = { full: 'all done', breaks: 'complete with breaks', some: 'partly done', none: 'nothing marked', empty: 'no habits yet', future: 'still to come' }
const STATUS_TEXT = { done: 'Done', break: 'Break' }

// v3.8 (owner): the habit months – opened from the calendar icon on the
// Habits card. This month and last month as calendars: a day is complete when
// every habit that existed that day was done (green) or done or on a break
// (green and violet); partly done days have a green ring. With habit groups,
// a filter shows one group. Tapping a day lists its habits below.
function HabitMonthWindow({ habits, groups = [], defaultGroupName = 'Other', today, onClose }) {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(today)
  const shownGroups = groups.length > 0 ? groupHabits(habits, groups, defaultGroupName, today) : []
  const filterKey = (group) => group.id ?? 'default'
  const shown = filter === 'all' ? habits : (shownGroups.find((group) => filterKey(group) === filter)?.habits ?? habits)
  const months = [monthStart(today), monthStart(today, 1)].map((first) => monthOverview(shown, first, today))

  return (
    <Modal open wide className="habit-month-window" onClose={onClose} title="Habit months" subtitle={`${shown.length} ${shown.length === 1 ? 'habit' : 'habits'} · tap a day for details`}>
      {shownGroups.length > 0 && (
        <div className="hm-filter" role="group" aria-label="Show">
          {[{ key: 'all', name: 'All habits' }, ...shownGroups.map((group) => ({ key: filterKey(group), name: group.name }))].map(({ key, name }) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {name}
            </button>
          ))}
        </div>
      )}

      {months.map((month) => (
        <MonthCalendar key={month.first} month={month} today={today} selected={selected} onSelect={setSelected} />
      ))}

      <ul className="hm-legend" aria-label="Legend">
        <li><span className="hm-swatch full" aria-hidden="true" />all done</li>
        <li><span className="hm-swatch breaks" aria-hidden="true" />complete with breaks</li>
        <li><span className="hm-swatch some" aria-hidden="true" />partly</li>
        <li><span className="hm-swatch none" aria-hidden="true" />nothing</li>
      </ul>

      <DayDetail habits={shown} day={selected} />
    </Modal>
  )
}

function MonthCalendar({ month, today, selected, onSelect }) {
  const complete = month.full + month.withBreaks
  return (
    <section className="hm-month" aria-label={formatMonth(month.first)}>
      <h3 className="hm-month-title">
        {formatMonth(month.first)} {month.first.slice(0, 4)}
        <span>
          {complete} complete{month.withBreaks > 0 ? ` · ${month.withBreaks} with breaks` : ''}
        </span>
      </h3>
      <div className="hm-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="hm-grid">
        {Array.from({ length: month.blanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {month.days.map((info) => (
          <button
            key={info.day}
            type="button"
            className={['hm-day', info.state, info.day === today && 'is-today'].filter(Boolean).join(' ')}
            aria-pressed={selected === info.day}
            aria-label={`${formatWeekday(info.day)} ${formatShortDate(info.day)}: ${dayText(info)}`}
            disabled={info.state === 'future'}
            onClick={() => onSelect(info.day)}
          >
            {Number(info.day.slice(8))}
          </button>
        ))}
      </div>
    </section>
  )
}

function DayDetail({ habits, day }) {
  return (
    <div className="hm-detail" aria-live="polite">
      <h3 className="hm-detail-title">
        {formatWeekday(day)} {formatShortDate(day)}
      </h3>
      {habits.length === 0 ? (
        <p className="empty-note">No habits here.</p>
      ) : (
        <ul className="hm-detail-list">
          {habits.map((habit) => {
            const status = dayStatus(habit, day)
            return (
              <li key={habit.id}>
                <span className="hm-detail-name">
                  <span aria-hidden="true">{habit.emoji}</span> {habit.name}
                </span>
                <span className={`hm-detail-status ${status ?? 'open'}`}>{STATUS_TEXT[status] ?? '–'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// What a day cell says to a screen reader.
function dayText({ state, done, breaks, total }) {
  if (state === 'future' || state === 'empty') return STATE_TEXT[state]
  const parts = [`${done} of ${total} done`]
  if (breaks > 0) parts.push(`${breaks} on a break`)
  return `${STATE_TEXT[state]}, ${parts.join(', ')}`
}

export default HabitMonthWindow

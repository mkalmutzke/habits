import { useMemo } from 'react'
import { insert, localOnly, newId, nowIso, remove, update } from '../../shared/data/changes.js'
import { useSave, useTable } from '../../shared/data/hooks.js'
import { toDateKey } from '../../shared/utils/date.js'
import { planMove } from '../../shared/utils/position.js'
import { reminderChanges, shapeHabits } from './habitData.js'

// Habits from the database (tables `habits` and `habit_completions`), shaped
// like before – { id, name, emoji, createdAt, completions: ['YYYY-MM-DD', …] } –
// so streaks, the week grid and the habit cards work unchanged.
export function useHabits(userId) {
  const habitRows = useTable('habits')
  const completionRows = useTable('habit_completions')
  const reminderRows = useTable('habit_reminders')
  const save = useSave()
  // v3: the daily reminder of each habit (at most one), by habit id
  const remindersByHabit = useMemo(() => new Map(reminderRows.rows.map((row) => [row.habit_id, row])), [reminderRows.rows])

  const habits = useMemo(() => shapeHabits(habitRows.rows, completionRows.rows), [habitRows.rows, completionRows.rows])
  const reminderChangesFor = (habitId, reminder) =>
    reminderChanges({ habitId, userId, existing: remindersByHabit.get(habitId), reminder })

  // reminder: { remind_time, channels } or null (design v3 §5.2)
  // values: { name, subtitle, emoji } (v3.1: subtitle optional)
  function addHabit({ name, subtitle = '', emoji }, reminder = null) {
    const last = habits.at(-1)
    const id = newId()
    save([
      insert('habits', { id, user_id: userId, name, subtitle, emoji, position: last ? last.position + 1 : 1, created_at: nowIso() }),
      ...reminderChangesFor(id, reminder),
    ])
    return id
  }

  function editHabit(id, { name, subtitle = '', emoji }, reminder = null) {
    save([update('habits', id, { name, subtitle, emoji }), ...reminderChangesFor(id, reminder)])
  }

  // Deleting a habit also deletes its check-offs (the database does that by
  // itself; the other changes only update the screen at once).
  function deleteHabit(id) {
    save([
      remove('habits', id),
      localOnly(remove('habit_completions', { habit_id: id })),
      localOnly(remove('habit_reminders', { habit_id: id })),
    ])
  }

  // v3.3 (§3.2): move the habit at `from` (order on screen) to `to`. Usually
  // only that habit gets a new position.
  function moveHabit(from, to) {
    const changes = planMove(habits, from, to)
    if (changes.length > 0) save(changes.map(({ id, position }) => update('habits', id, { position })))
  }

  function toggleToday(id, day = toDateKey()) {
    const habit = habits.find((item) => item.id === id)
    if (!habit) return
    save(
      habit.completions.includes(day)
        ? remove('habit_completions', { habit_id: id, day })
        : insert('habit_completions', { habit_id: id, day, user_id: userId }),
    )
  }

  return {
    habits,
    loading: habitRows.loading || completionRows.loading,
    error: habitRows.error ?? completionRows.error,
    reminders: reminderRows.rows,
    remindersByHabit,
    addHabit,
    editHabit,
    deleteHabit,
    moveHabit,
    toggleToday,
  }
}

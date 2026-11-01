import { useMemo } from 'react'
import { insert, localOnly, newId, nextPosition, nowIso, remove, update } from '../../shared/data/changes.js'
import { useSave, useTable } from '../../shared/data/hooks.js'
import { toDateKey } from '../../shared/utils/date.js'
import { byPosition, planMove } from '../../shared/utils/position.js'
import { reminderChanges, shapeHabits } from './habitData.js'

// Habits from the database (tables `habits` and `habit_completions`), shaped
// like before – { id, name, emoji, createdAt, completions: ['YYYY-MM-DD', …] } –
// so streaks, the week grid and the habit cards work unchanged.
export function useHabits(userId) {
  const habitRows = useTable('habits')
  const completionRows = useTable('habit_completions')
  const reminderRows = useTable('habit_reminders')
  const groupRows = useTable('habit_groups')
  const save = useSave()
  // v3: the daily reminder of each habit (at most one), by habit id
  const remindersByHabit = useMemo(() => new Map(reminderRows.rows.map((row) => [row.habit_id, row])), [reminderRows.rows])

  const habits = useMemo(() => shapeHabits(habitRows.rows, completionRows.rows), [habitRows.rows, completionRows.rows])
  // v3.6: the user's habit groups, in order (the default group is not a row)
  const groups = useMemo(() => [...groupRows.rows].sort(byPosition), [groupRows.rows])
  const reminderChangesFor = (habitId, reminder) =>
    reminderChanges({ habitId, userId, existing: remindersByHabit.get(habitId), reminder })

  // reminder: { remind_time, channels } or null (design v3 §5.2)
  // values: { name, subtitle, emoji, groupId } (v3.1: subtitle optional;
  // v3.6: groupId null = the default group)
  function addHabit({ name, subtitle = '', emoji, groupId = null }, reminder = null) {
    const last = habits.at(-1)
    const id = newId()
    save([
      insert('habits', { id, user_id: userId, name, subtitle, emoji, group_id: groupId, position: last ? last.position + 1 : 1, created_at: nowIso() }),
      ...reminderChangesFor(id, reminder),
    ])
    return id
  }

  function editHabit(id, { name, subtitle = '', emoji, groupId = null }, reminder = null) {
    save([update('habits', id, { name, subtitle, emoji, group_id: groupId }), ...reminderChangesFor(id, reminder)])
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
  // v3.6: `within` (optional) is the list the indexes refer to, e.g. the
  // habits of one group – moving only changes the order inside it.
  function moveHabit(from, to, within = habits) {
    const changes = planMove(within, from, to)
    if (changes.length > 0) save(changes.map(({ id, position }) => update('habits', id, { position })))
  }

  // v3.6: managing the groups (Settings → Habit groups)
  function addGroup(name) {
    save(insert('habit_groups', { id: newId(), user_id: userId, name, position: nextPosition(groups), created_at: nowIso() }))
  }

  function renameGroup(id, name) {
    save(update('habit_groups', id, { name }))
  }

  // Its habits move to the default group (the database does that by itself).
  function deleteGroup(id) {
    save([remove('habit_groups', id), localOnly(update('habits', { group_id: id }, { group_id: null }))])
  }

  function moveGroup(from, to) {
    const changes = planMove(groups, from, to)
    if (changes.length > 0) save(changes.map(({ id, position }) => update('habit_groups', id, { position })))
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
    groups,
    addGroup,
    renameGroup,
    deleteGroup,
    moveGroup,
    addHabit,
    editHabit,
    deleteHabit,
    moveHabit,
    toggleToday,
  }
}

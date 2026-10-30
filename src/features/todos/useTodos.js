import { useMemo } from 'react'
import { insert, localOnly, newId, nextPosition, nowIso, remove, update } from '../../shared/data/changes.js'
import { useSave, useTable } from '../../shared/data/hooks.js'
import { byPosition, positionBetween } from '../../shared/utils/position.js'
import { nextDueDate } from './repeat.js'

// Everything about to-dos: the rows of the four to-do tables and every change
// the screens can make. Each change shows at once and is saved straight away
// (useSave: undone on screen if the database says no).
export function useTodos(userId, today) {
  const groups = useTable('todo_groups')
  const lists = useTable('todo_lists')
  const tasks = useTable('todo_tasks')
  const steps = useTable('todo_steps')
  const save = useSave()

  const data = useMemo(
    () => ({
      groups: [...groups.rows].sort(byPosition),
      lists: [...lists.rows].sort(byPosition),
      tasks: tasks.rows,
      steps: [...steps.rows].sort(byPosition),
    }),
    [groups.rows, lists.rows, tasks.rows, steps.rows],
  )

  // A new row of `table` at the end of `rows`; returns its id.
  function add(table, rows, values) {
    const id = newId()
    save(insert(table, { id, user_id: userId, position: nextPosition(rows), created_at: nowIso(), ...values }))
    return id
  }

  // --- groups ---
  const addGroup = (name) => add('todo_groups', data.groups, { name, collapsed: false })
  const updateGroup = (id, values) => save(update('todo_groups', id, values))
  // the lists stay, outside any group (the database does the same)
  const deleteGroup = (id) =>
    save([remove('todo_groups', id), localOnly(update('todo_lists', { group_id: id }, { group_id: null }))])

  // --- lists ---
  const addList = ({ name, color, groupId = null, showInAll = true }) =>
    add('todo_lists', data.lists, { group_id: groupId, name, color, show_in_all: showInAll })
  const updateList = (id, values) => save(update('todo_lists', id, values))
  // its tasks (and their steps) go with it
  function deleteList(id) {
    const taskIds = data.tasks.filter((task) => task.list_id === id).map((task) => task.id)
    save([
      remove('todo_lists', id),
      localOnly(remove('todo_tasks', { list_id: id })),
      ...taskIds.map((taskId) => localOnly(remove('todo_steps', { task_id: taskId }))),
    ])
  }

  // --- tasks ---
  // listId: an own list's id, or null for no list. The options set what the
  // source it was added from stands for (sources.js addDefaults).
  const addTask = (title, { listId = null, important = false, dueDate = null } = {}) =>
    add('todo_tasks', data.tasks, { list_id: listId, title, notes: '', due_date: dueDate, important, repeat_rule: null, completed_at: null })

  const updateTask = (id, values) => save(update('todo_tasks', id, values))

  // Ticking a repeating task completes it and creates the next one (one
  // database function, so both happen together or not at all).
  function toggleTask(task) {
    if (task.completed_at) return updateTask(task.id, { completed_at: null })
    if (!task.repeat_rule) return updateTask(task.id, { completed_at: nowIso() })
    const nextId = newId()
    const nextDue = nextDueDate(task.repeat_rule, task.due_date ?? today)
    const taskSteps = data.steps.filter((step) => step.task_id === task.id)
    save({
      action: 'rpc',
      fn: 'complete_repeating_task',
      args: { task_id: task.id, next_id: nextId, next_due: nextDue },
      optimistic: [
        update('todo_tasks', task.id, { completed_at: nowIso() }),
        insert('todo_tasks', { ...task, id: nextId, due_date: nextDue, completed_at: null, created_at: nowIso() }),
        ...taskSteps.map((step) => insert('todo_steps', { ...step, id: newId(), task_id: nextId, done: false })),
      ],
      refresh: ['todo_tasks', 'todo_steps'],
    })
  }

  // v3 (D1): "Delete" keeps the task for 10 days – it can be restored; the
  // database removes it for good afterwards (job purge-deleted-tasks).
  const deleteTask = (id) => updateTask(id, { deleted_at: nowIso() })
  const restoreTask = (id) => updateTask(id, { deleted_at: null })

  // "Delete now": gone at once, with its steps (the database does that too).
  const purgeTask = (id) => save([remove('todo_tasks', id), localOnly(remove('todo_steps', { task_id: id }))])

  // Move a task one place up or down within the given (sorted) list of tasks.
  function moveTask(task, orderedTasks, direction) {
    const index = orderedTasks.findIndex((item) => item.id === task.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= orderedTasks.length) return
    const neighbour = orderedTasks[target]
    const beyond = orderedTasks[target + direction]
    const position = direction < 0 ? positionBetween(beyond?.position, neighbour.position) : positionBetween(neighbour.position, beyond?.position)
    updateTask(task.id, { position })
  }

  // --- steps ---
  const addStep = (taskId, title) =>
    add('todo_steps', data.steps.filter((step) => step.task_id === taskId), { task_id: taskId, title, done: false })
  const updateStep = (id, values) => save(update('todo_steps', id, values))
  const deleteStep = (id) => save(remove('todo_steps', id))

  return {
    ...data,
    loading: groups.loading || lists.loading || tasks.loading || steps.loading,
    addGroup,
    updateGroup,
    deleteGroup,
    addList,
    updateList,
    deleteList,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    restoreTask,
    purgeTask,
    moveTask,
    addStep,
    updateStep,
    deleteStep,
  }
}

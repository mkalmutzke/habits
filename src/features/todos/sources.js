import { byPosition } from '../../shared/utils/position.js'

// Where tasks are shown from (design v3 §4.1): the "source" of a task list.
//   'all'          the combined view: tasks without a list and the tasks of
//                  every list that is shown in All (v3.3, `show_in_all`)
//   'important'    starred tasks
//   'planned'      tasks with a due date
//   'group:<id>'   the tasks of every list in a group
//   '<list id>'    the tasks of one list
// v2's "My Day" and "Tasks" are gone; their old addresses show All.

export const FIXED_SOURCES = [
  { id: 'all', name: 'All', color: 'amber' },
  { id: 'important', name: 'Important', color: 'coral' },
  { id: 'planned', name: 'Planned', color: 'teal' },
]

export const RETIRED = ['my-day', 'tasks']

export function groupSource(groupId) {
  return `group:${groupId}`
}

// The source a (possibly old or unknown) id stands for: retired and deleted
// ones fall back to All.
export function resolveSource(id, lists, groups) {
  if (!id || RETIRED.includes(id)) return 'all'
  if (FIXED_SOURCES.some((source) => source.id === id)) return id
  if (id.startsWith('group:')) return groups.some((group) => groupSource(group.id) === id) ? id : 'all'
  return lists.some((list) => list.id === id) ? id : 'all'
}

// Is a list part of All? (v3.3; rows cached before 3.3 have no field → yes)
export function isInAll(list) {
  return list?.show_in_all !== false
}

// Does a task belong to a source?
export function inSource(task, source, lists) {
  switch (source) {
    case 'all':
      return task.list_id === null || isInAll(lists.find((list) => list.id === task.list_id))
    case 'important':
      return task.important
    case 'planned':
      return task.due_date !== null
    default:
      if (source.startsWith('group:')) {
        const groupId = source.slice('group:'.length)
        return lists.some((list) => list.id === task.list_id && list.group_id === groupId)
      }
      return task.list_id === source
  }
}

// Open tasks: All and Planned by due date (overdue, today, later, then no
// date – owner decision D6), then by their own order; lists and groups by
// their own order.
export function sortOpen(tasks, source) {
  if (source === 'all' || source === 'planned') {
    return [...tasks].sort((a, b) => {
      if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date && !b.due_date) return -1
      if (!a.due_date && b.due_date) return 1
      return byPosition(a, b)
    })
  }
  return [...tasks].sort(byPosition)
}

// Name and colour to show for a source.
export function describeSource(source, lists, groups) {
  const fixed = FIXED_SOURCES.find((item) => item.id === source)
  if (fixed) return { name: fixed.name, color: fixed.color, kind: 'fixed' }
  if (source.startsWith('group:')) {
    const group = groups.find((item) => groupSource(item.id) === source)
    return { name: group?.name ?? 'Group', color: 'group', kind: 'group' }
  }
  const list = lists.find((item) => item.id === source)
  return { name: list?.name ?? 'List', color: list?.color ?? 'blue', kind: 'list' }
}

// What a task added while a source is shown gets (design §2.3): its list,
// the star (Important) or a due date of today (Planned). A group puts it into
// its first list (owner, review point 3).
export function addDefaults(source, lists, today) {
  if (source === 'important') return { listId: null, important: true, dueDate: null }
  if (source === 'planned') return { listId: null, important: false, dueDate: today }
  if (source === 'all') return { listId: null, important: false, dueDate: null }
  if (source.startsWith('group:')) {
    const groupId = source.slice('group:'.length)
    const first = [...lists].filter((list) => list.group_id === groupId).sort(byPosition)[0]
    return { listId: first?.id ?? null, important: false, dueDate: null }
  }
  return { listId: source, important: false, dueDate: null }
}

// Every source in the order of the switcher: All, Important, Planned, each
// group followed by its lists, then the lists without a group.
export function sourceOptions(lists, groups) {
  const options = FIXED_SOURCES.map((source) => ({ id: source.id, name: source.name, kind: 'fixed', color: source.color }))
  for (const group of [...groups].sort(byPosition)) {
    options.push({ id: groupSource(group.id), name: group.name, kind: 'group', color: 'group' })
    for (const list of lists.filter((item) => item.group_id === group.id).sort(byPosition)) {
      options.push({ id: list.id, name: list.name, kind: 'list', color: list.color, nested: true })
    }
  }
  for (const list of lists.filter((item) => item.group_id === null).sort(byPosition)) {
    options.push({ id: list.id, name: list.name, kind: 'list', color: list.color })
  }
  return options
}

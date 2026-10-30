import { addDays, formatShortDate, formatWeekday } from '../../shared/utils/date.js'

// Small helpers for task lists. Which tasks a list shows: sources.js.

// v3 (D1): a deleted task is kept for 10 days (deleted_at) and is neither
// open nor completed – it shows only in the "Deleted" fold.
export const KEEP_DELETED_DAYS = 10

export function isDeleted(task) {
  return Boolean(task.deleted_at)
}

export function isOpen(task) {
  return task.completed_at === null && !isDeleted(task)
}

export function isCompleted(task) {
  return task.completed_at !== null && !isDeleted(task)
}

// Whole days until a deleted task is removed for good (at least 0).
export function daysLeft(task, now = new Date()) {
  const gone = new Date(task.deleted_at).getTime() + KEEP_DELETED_DAYS * 86_400_000
  return Math.max(0, Math.ceil((gone - now.getTime()) / 86_400_000))
}

// Most recently deleted first.
export function sortDeleted(tasks) {
  return [...tasks].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))
}

// Newest completed first.
export function sortCompleted(tasks) {
  return [...tasks].sort((a, b) => b.completed_at.localeCompare(a.completed_at))
}

// "Today", "Tomorrow", "Yesterday", "Mon 12 Oct" – and whether it's overdue.
export function describeDue(dueDate, today) {
  if (!dueDate) return null
  let text
  if (dueDate === today) text = 'Today'
  else if (dueDate === addDays(today, 1)) text = 'Tomorrow'
  else if (dueDate === addDays(today, -1)) text = 'Yesterday'
  else text = `${formatWeekday(dueDate)} ${formatShortDate(dueDate)}`
  const tone = dueDate < today ? 'overdue' : dueDate === today ? 'today' : 'later'
  return { text, tone }
}

// Search over titles, notes and step titles (case-insensitive).
export function matchesSearch(task, steps, query) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return false
  const haystack = [task.title, task.notes, ...steps.map((step) => step.title)]
  return haystack.some((text) => text?.toLocaleLowerCase().includes(needle))
}

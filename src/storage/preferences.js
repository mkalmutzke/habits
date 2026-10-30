import { readItem, writeItem } from './localStore.js'

// Small per-device settings (how the screen looks here – not data, so they
// are not stored in the cloud).
const TODO_SOURCE_KEY = 'habits.whatsup.todo-source'

// Which tasks the ToDo's section on What's up? shows (design v3 §2.3).
export function loadTodoSource() {
  return readItem(TODO_SOURCE_KEY) ?? 'all'
}

export function saveTodoSource(source) {
  writeItem(TODO_SOURCE_KEY, source)
}

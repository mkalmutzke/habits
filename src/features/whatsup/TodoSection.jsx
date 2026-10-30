import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { navigate } from '../../shared/hooks/useRoute.js'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'
import Icon from '../../shared/ui/Icon.jsx'
import { loadTodoSource, saveTodoSource } from '../../storage/preferences.js'
import DeletedTasks from '../todos/DeletedTasks.jsx'
import { isCompleted, isDeleted, isOpen, sortCompleted } from '../todos/smartLists.js'
import SourceSwitcher from '../todos/SourceSwitcher.jsx'
import { describeSource, inSource, resolveSource, sortOpen } from '../todos/sources.js'
import TaskList from '../todos/TaskList.jsx'

// "ToDo's" on What's up? (design v3 §2.3): every open task – not only
// today's – from the chosen source (All by default, remembered on this
// device), a small ＋ that opens a new task's details, and the completed
// tasks folded away. v3.3 (owner, R5): a foldable card like Habits that
// starts open; the source chip sits on the card's first line.
function TodoSection({ todos, today, reminderText, showDeleted = true }) {
  const online = useOnline()
  const [stored, setStored] = useState(loadTodoSource)
  const [showCompleted, setShowCompleted] = useState(false)
  const section = useSectionOpen('todos', true)
  // a deleted list or group falls back to All
  const source = todos.loading ? stored : resolveSource(stored, todos.lists, todos.groups)

  const tasks = todos.tasks.filter((task) => inSource(task, source, todos.lists))
  const open = sortOpen(tasks.filter(isOpen), source)
  const done = sortCompleted(tasks.filter(isCompleted))
  const deleted = showDeleted ? tasks.filter(isDeleted) : []

  function changeSource(id) {
    setStored(id)
    saveTodoSource(id)
  }

  return (
    <CollapsibleSection
      state={section}
      className="todo-section"
      title="ToDo’s"
      summary={`${describeSource(source, todos.lists, todos.groups).name} · ${open.length} open`}
      actions={
        <button
          type="button"
          className="section-icon-button add"
          aria-label="Add a task"
          onClick={() => navigate(`/task/new?source=${encodeURIComponent(source)}`)}
          disabled={!online}
        >
          <Icon name="plus" />
        </button>
      }
    >
      <div className="todo-source-line">
        <span className="todo-source-label">Showing</span>
        <SourceSwitcher value={source} onChange={changeSource} lists={todos.lists} groups={todos.groups} />
      </div>

      {open.length === 0 && done.length === 0 && deleted.length === 0 && (
        <p className="empty-note">{todos.loading ? 'Loading…' : 'Nothing to do here – tap ＋ to add a task.'}</p>
      )}

      <TaskList tasks={open} todos={todos} today={today} listId={source} reminderText={reminderText} />

      {done.length > 0 && (
        <>
          <button
            type="button"
            className="completed-toggle"
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            <Icon name="chevronRight" className="chevron" />
            Completed · {done.length}
          </button>
          {showCompleted && <TaskList tasks={done} todos={todos} today={today} listId={source} reminderText={reminderText} />}
        </>
      )}

      <DeletedTasks tasks={deleted} todos={todos} />
    </CollapsibleSection>
  )
}

export default TodoSection

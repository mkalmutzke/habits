import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import BackLink from '../../shared/ui/BackLink.jsx'
import Icon from '../../shared/ui/Icon.jsx'
import AddTaskBar from './AddTaskBar.jsx'
import GroupModal from './GroupModal.jsx'
import ListModal from './ListModal.jsx'
import { SMART_ICONS } from './listStyle.js'
import DeletedTasks from './DeletedTasks.jsx'
import { isCompleted, isDeleted, isOpen, sortCompleted } from './smartLists.js'
import { addDefaults, describeSource, FIXED_SOURCES, inSource, RETIRED, sortOpen } from './sources.js'
import TaskList from './TaskList.jsx'

// The tasks of one source (mockup 3, design v3 §4.1): All, Important,
// Planned, a group (all its lists together) or one list – open tasks, a
// collapsible "Completed" section and the add bar at the bottom.
function ListView({ listId, todos, today, reminderText, showDeleted = true }) {
  const online = useOnline()
  const [showCompleted, setShowCompleted] = useState(false)
  const [editing, setEditing] = useState(false)
  // v2's My Day and Tasks are gone: their addresses show All
  const source = RETIRED.includes(listId) ? 'all' : listId
  const fixed = FIXED_SOURCES.find((item) => item.id === source)
  const group = source.startsWith('group:') ? todos.groups.find((item) => `group:${item.id}` === source) : null
  const own = todos.lists.find((list) => list.id === source)

  if (!fixed && !group && !own) {
    return (
      <div className="list-page">
        <BackLink href="#/lists">Lists</BackLink>
        <p className="empty-note">{todos.loading ? 'Loading…' : 'This list doesn’t exist (any more).'}</p>
      </div>
    )
  }

  const { name } = describeSource(source, todos.lists, todos.groups)
  const ownGroup = own && todos.groups.find((item) => item.id === own.group_id)
  const all = todos.tasks.filter((task) => inSource(task, source, todos.lists))
  const open = sortOpen(all.filter(isOpen), source)
  const done = sortCompleted(all.filter(isCompleted))
  const deleted = showDeleted ? all.filter(isDeleted) : []
  const groupLists = group ? todos.lists.filter((list) => list.group_id === group.id) : []

  // A task added here gets this source's property (like Microsoft To Do).
  function handleAdd(title) {
    todos.addTask(title, addDefaults(source, todos.lists, today))
  }

  return (
    <div className="list-page">
      <div className="page-top">
        <BackLink href="#/lists">Lists</BackLink>
        {(own || group) && (
          <button
            type="button"
            className="icon-button"
            aria-label={own ? `Edit list ${own.name}` : `Edit group ${group.name}`}
            onClick={() => setEditing(true)}
            disabled={!online}
          >
            ⋯
          </button>
        )}
      </div>

      <header className="list-header">
        {fixed && (
          <span className={`list-icon large color-${fixed.color}`} aria-hidden="true">
            <Icon path={SMART_ICONS[fixed.id]} />
          </span>
        )}
        {group && (
          <span className="list-icon large group-icon" aria-hidden="true">
            <Icon path={SMART_ICONS.group} />
          </span>
        )}
        {own && <span className={`list-dot large color-${own.color}`} aria-hidden="true" />}
        <div>
          <h1 className="page-title">{name}</h1>
          <p className="list-meta">
            {ownGroup && `${ownGroup.name} · `}
            {group && `${groupLists.length} ${groupLists.length === 1 ? 'list' : 'lists'} · `}
            {open.length} open{(source === 'planned' || source === 'all') && ' · by due date'}
          </p>
        </div>
      </header>

      {open.length === 0 && done.length === 0 && deleted.length === 0 && (
        <p className="empty-note">No tasks yet – add the first one below.</p>
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

      <div className="bottom-dock">
        <AddTaskBar placeholder={`Add a task to ${name}`} onAdd={handleAdd} disabled={!online} />
      </div>

      {editing && own && <ListModal todos={todos} list={own} onClose={() => setEditing(false)} />}
      {editing && group && <GroupModal todos={todos} group={group} onClose={() => setEditing(false)} />}
    </div>
  )
}

export default ListView

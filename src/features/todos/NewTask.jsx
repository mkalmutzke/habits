import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import BackLink from '../../shared/ui/BackLink.jsx'
import { cleanText } from '../../shared/utils/text.js'
import { addDefaults, describeSource, resolveSource } from './sources.js'

// A new task (design v3 §2.3, owner decision D7): only the title at first,
// focused. Enter or leaving the field creates the task – in the list the
// source stands for – and the full details take over. An empty title adds
// nothing.
function NewTask({ source, todos, today }) {
  const online = useOnline()
  const [title, setTitle] = useState('')
  const resolved = resolveSource(source, todos.lists, todos.groups)
  const defaults = addDefaults(resolved, todos.lists, today)
  const target = defaults.listId ? describeSource(defaults.listId, todos.lists, todos.groups).name : 'No list'
  const extras = [defaults.important && 'marked important', defaults.dueDate && 'due today'].filter(Boolean)

  function create() {
    const trimmed = cleanText(title, 255)
    if (!trimmed) return
    const id = todos.addTask(trimmed, defaults)
    // replace: "back" goes to where you came from, not to this empty page
    window.location.replace(`#/task/${id}`)
  }

  return (
    <div className="task-page">
      <div className="page-top">
        <BackLink href="#/today">What’s up?</BackLink>
        <span className="save-state" role="status">
          {!online ? 'Offline · read only' : title.trim() ? 'Saved when you leave the title' : 'Not saved yet'}
        </span>
      </div>

      <section className="detail-card title-card new" aria-label="New task">
        <span className="task-check large placeholder" aria-hidden="true" />
        <textarea
          className="title-input"
          value={title}
          rows={1}
          // the one field of this page gets the focus at once (owner decision D7)
          autoFocus
          placeholder="What needs doing?"
          onChange={(event) => setTitle(event.target.value.replace(/\n/g, ''))}
          onBlur={create}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          aria-label="Task title"
          maxLength={255}
          disabled={!online}
        />
      </section>
      <p className="new-task-hint">
        Goes to <strong>{target}</strong>
        {extras.length > 0 && `, ${extras.join(', ')}`}. Due date, reminder, repeat, steps and notes can be set once it
        has a title.
      </p>
    </div>
  )
}

export default NewTask

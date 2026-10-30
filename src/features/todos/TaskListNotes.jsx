import { useOnline } from '../../shared/data/hooks.js'
import { useDraft } from '../../shared/hooks/useDraft.js'

// The task's list (a select) and its notes (saved when you leave the field).
function TaskListNotes({ task, todos, update }) {
  const online = useOnline()
  const [notes, setNotes] = useDraft(task.notes)
  const list = todos.lists.find((item) => item.id === task.list_id)

  function saveNotes() {
    if (notes !== task.notes) update({ notes: notes.slice(0, 10000) })
  }

  return (
    <section className="detail-card rows" aria-label="List and notes">
      <label className="detail-row">
        <span className={`list-dot color-${list?.color ?? 'none'}`} aria-hidden="true" />
        <span className="detail-row-label">List</span>
        <select
          className="input compact"
          value={task.list_id ?? ''}
          onChange={(event) => update({ list_id: event.target.value || null })}
          disabled={!online}
        >
          <option value="">No list</option>
          {todos.lists.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="notes-field">
        <span className="field-label">Notes</span>
        <textarea
          className="input"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={saveNotes}
          maxLength={10000}
          disabled={!online}
        />
      </label>
    </section>
  )
}

export default TaskListNotes

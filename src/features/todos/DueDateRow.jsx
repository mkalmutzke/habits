import { useOnline } from '../../shared/data/hooks.js'
import Icon from '../../shared/ui/Icon.jsx'
import { describeDue } from './smartLists.js'

const RELATIVE_DAYS = ['Today', 'Tomorrow', 'Yesterday']

// "Due today" / "Add due date" with a date field and × to remove it.
function DueDateRow({ task, today, update }) {
  const online = useOnline()
  const due = describeDue(task.due_date, today)
  return (
    <div className="detail-row">
      <Icon name="calendar" />
      <label className="detail-row-label" htmlFor="due-date">
        {due ? `Due ${RELATIVE_DAYS.includes(due.text) ? due.text.toLowerCase() : due.text}` : 'Add due date'}
      </label>
      <input
        id="due-date"
        type="date"
        className="input compact"
        value={task.due_date ?? ''}
        onChange={(event) => update({ due_date: event.target.value || null })}
        disabled={!online}
      />
      {task.due_date && (
        <button type="button" className="row-clear" aria-label="Remove due date" onClick={() => update({ due_date: null })} disabled={!online}>
          ×
        </button>
      )}
    </div>
  )
}

export default DueDateRow

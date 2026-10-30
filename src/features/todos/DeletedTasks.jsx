import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import Icon from '../../shared/ui/Icon.jsx'
import { daysLeft, sortDeleted } from './smartLists.js'

// "Deleted · n" (design v3 §5.3, owner decision D1): deleted tasks stay for
// 10 days, greyed out, with Restore and Delete now. Shown only when the
// setting "Show deleted tasks" is on (Settings → To-dos).
function DeletedTasks({ tasks, todos }) {
  const online = useOnline()
  const [open, setOpen] = useState(false)
  if (tasks.length === 0) return null

  return (
    <>
      <button type="button" className="completed-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="chevronRight" className="chevron" />
        Deleted · {tasks.length}
      </button>
      {open && (
        <ul className="task-list deleted-list">
          {sortDeleted(tasks).map((task) => {
            const left = daysLeft(task)
            return (
              <li key={task.id} className="deleted-row">
                <a className="deleted-main" href={`#/task/${task.id}`}>
                  <span className="deleted-title">{task.title}</span>
                  <span className="task-meta">
                    deleted · gone for good {left === 0 ? 'today' : `in ${left} ${left === 1 ? 'day' : 'days'}`}
                  </span>
                </a>
                <button type="button" className="button-outline small" onClick={() => todos.restoreTask(task.id)} disabled={!online}>
                  Restore
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export default DeletedTasks

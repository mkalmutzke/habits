import { hapticLight, hapticSuccess } from '../../shared/utils/haptics.js'
import Icon from '../../shared/ui/Icon.jsx'
import { describeRule } from './repeat.js'
import { describeDue } from './smartLists.js'

// One task in a list (mockups 1 and 3): round check button, title and small
// details (list, due date, reminder, repeat, steps), and the star.
// The title opens the task details (#/task/<id>).
function TaskRow({ task, today, listName, steps = [], reminder, onToggle, onStar, disabled = false }) {
  const done = task.completed_at !== null
  const due = describeDue(task.due_date, today)
  const doneSteps = steps.filter((step) => step.done).length

  function handleToggle() {
    if (done) hapticLight()
    else hapticSuccess()
    onToggle(task)
  }

  return (
    <li className={done ? 'task-row done' : 'task-row'}>
      <button
        type="button"
        className="task-check"
        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${task.title}`}
        aria-pressed={done}
        onClick={handleToggle}
        disabled={disabled}
      >
        <Icon name="check" />
      </button>
      <a className="task-main" href={`#/task/${task.id}`}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {listName && <span>{listName}</span>}
          {due && <span className={`due tone-${done ? 'later' : due.tone}`}>{due.text}</span>}
          {reminder && <span className="meta-reminder">⏰ {reminder}</span>}
          {task.repeat_rule && <span>↻ {describeRule(task.repeat_rule)}</span>}
          {steps.length > 0 && (
            <span>
              {doneSteps} of {steps.length}
            </span>
          )}
        </span>
      </a>
      <button
        type="button"
        className={task.important ? 'task-star on' : 'task-star'}
        aria-label={`${task.important ? 'Remove importance' : 'Mark important'}: ${task.title}`}
        aria-pressed={task.important}
        onClick={() => onStar(task)}
        disabled={disabled}
      >
        <Icon name="star" />
      </button>
    </li>
  )
}

export default TaskRow

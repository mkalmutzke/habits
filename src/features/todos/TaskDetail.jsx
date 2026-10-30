import { useIsMutating } from '@tanstack/react-query'
import { useOnline } from '../../shared/data/hooks.js'
import { SAVE_KEY } from '../../shared/data/refresh.js'
import { navigate } from '../../shared/hooks/useRoute.js'
import BackLink from '../../shared/ui/BackLink.jsx'
import ConfirmDelete from '../../shared/ui/ConfirmDelete.jsx'
import { formatShortDate, toDateKey } from '../../shared/utils/date.js'
import DueDateRow from './DueDateRow.jsx'
import NewTask from './NewTask.jsx'
import RepeatRow from './RepeatRow.jsx'
import { daysLeft, isDeleted, isOpen } from './smartLists.js'
import { inSource, sortOpen } from './sources.js'
import TaskListNotes from './TaskListNotes.jsx'
import TaskSteps from './TaskSteps.jsx'
import TaskTitleCard from './TaskTitleCard.jsx'

// Task details (mockup 4): title, done, important, steps, reminder (passed
// in as `reminder`, from the notifications feature), due date, repeat, list,
// notes, order and delete. Every change is saved at once.
// `taskId` "new" (v3 §2.3): an empty task whose title has the focus; it is
// created as soon as it has a title, in the list `source` stands for.
function TaskDetail({ taskId, source = 'all', todos, today, reminder = null }) {
  const task = todos.tasks.find((item) => item.id === taskId)

  if (taskId === 'new') return <NewTask source={source} todos={todos} today={today} />

  if (!task) {
    return (
      <div className="task-page">
        <a className="back-link" href="#/lists">
          ‹ Lists
        </a>
        <p className="empty-note">{todos.loading ? 'Loading…' : 'This task doesn’t exist (any more).'}</p>
      </div>
    )
  }

  // key: another task starts with fresh fields
  return <TaskDetailBody key={task.id} task={task} todos={todos} today={today} reminder={reminder} />
}

function TaskDetailBody({ task, todos, today, reminder }) {
  const online = useOnline()
  const saving = useIsMutating({ mutationKey: SAVE_KEY }) > 0
  const done = task.completed_at !== null
  const deleted = isDeleted(task)
  const list = todos.lists.find((item) => item.id === task.list_id)
  // back to the task's list – or to What's up? for a task without a list
  const back = list ? { href: `#/list/${list.id}`, name: list.name } : { href: '#/today', name: 'What’s up?' }
  const update = (values) => todos.updateTask(task.id, values)
  const leave = () => navigate(back.href.slice(1))

  const siblingSource = list ? list.id : 'all'
  const siblings = sortOpen(todos.tasks.filter((item) => isOpen(item) && inSource(item, siblingSource, todos.lists)), siblingSource)
  const index = siblings.findIndex((item) => item.id === task.id)
  const left = daysLeft(task)

  return (
    <div className="task-page">
      <div className="page-top">
        <BackLink href={back.href}>{back.name}</BackLink>
        <span className="save-state" role="status">
          {!online ? 'Offline · read only' : saving ? 'Saving…' : 'Saved'}
        </span>
      </div>

      {deleted && (
        <p className="deleted-banner" role="status">
          <span>Deleted – gone for good {left === 0 ? 'today' : `in ${left} ${left === 1 ? 'day' : 'days'}`}.</span>
          <button type="button" className="button-outline small" onClick={() => todos.restoreTask(task.id)} disabled={!online}>
            Restore
          </button>
        </p>
      )}

      <TaskTitleCard task={task} todos={todos} update={update} />
      <TaskSteps task={task} todos={todos} />

      <section className="detail-card rows" aria-label="Planning">
        {reminder}

        <DueDateRow task={task} today={today} update={update} />
        <RepeatRow task={task} update={update} />
      </section>

      <TaskListNotes task={task} todos={todos} update={update} />

      {!done && siblings.length > 1 && (
        <div className="move-row" role="group" aria-label="Order in the list">
          <button type="button" className="button-outline" onClick={() => todos.moveTask(task, siblings, -1)} disabled={!online || index <= 0}>
            ↑ Move up
          </button>
          <button
            type="button"
            className="button-outline"
            onClick={() => todos.moveTask(task, siblings, 1)}
            disabled={!online || index >= siblings.length - 1}
          >
            ↓ Move down
          </button>
        </div>
      )}

      <footer className="task-footer">
        <span className="list-meta">Created {formatShortDate(toDateKey(new Date(task.created_at)))}</span>
        {deleted ? (
          // already deleted: the only way left is "for good"
          <ConfirmDelete
            inline
            label="Delete now"
            confirmLabel="Delete for good"
            onConfirm={() => {
              todos.purgeTask(task.id)
              leave()
            }}
            disabled={!online}
            confirmDisabled={false}
          />
        ) : (
          // v3 (D1): kept for 10 days, can be restored – no question needed
          <button
            type="button"
            className="button-danger"
            onClick={() => {
              todos.deleteTask(task.id)
              leave()
            }}
            disabled={!online}
          >
            Delete
          </button>
        )}
      </footer>
    </div>
  )
}

export default TaskDetail

import { useOnline } from '../../shared/data/hooks.js'
import TaskRow from './TaskRow.jsx'

// A list of task rows with everything they need from the to-do data.
// Outside a single list each row also shows which list the task belongs to.
function TaskList({ tasks, todos, today, listId, reminderText }) {
  const online = useOnline()
  if (tasks.length === 0) return null
  const showListName = !todos.lists.some((list) => list.id === listId)
  const listName = (task) => todos.lists.find((list) => list.id === task.list_id)?.name ?? 'No list'

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          today={today}
          listName={showListName ? listName(task) : null}
          steps={todos.steps.filter((step) => step.task_id === task.id)}
          reminder={reminderText?.(task)}
          onToggle={todos.toggleTask}
          onStar={(item) => todos.updateTask(item.id, { important: !item.important })}
          disabled={!online}
        />
      ))}
    </ul>
  )
}

export default TaskList

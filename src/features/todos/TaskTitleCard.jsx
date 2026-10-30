import { useOnline } from '../../shared/data/hooks.js'
import { useDraft } from '../../shared/hooks/useDraft.js'
import Icon from '../../shared/ui/Icon.jsx'
import { cleanText } from '../../shared/utils/text.js'

// Top card of the task page: done, title (saved when you leave it) and star.
function TaskTitleCard({ task, todos, update }) {
  const online = useOnline()
  const [title, setTitle] = useDraft(task.title)
  const done = task.completed_at !== null

  function saveTitle() {
    const trimmed = cleanText(title, 255)
    if (!trimmed) setTitle(task.title)
    else if (trimmed !== task.title) update({ title: trimmed })
  }

  return (
    <section className="detail-card title-card" aria-label="Task">
      <button
        type="button"
        className="task-check large"
        aria-label={done ? 'Mark not done' : 'Mark done'}
        aria-pressed={done}
        onClick={() => todos.toggleTask(task)}
        disabled={!online}
      >
        <Icon name="check" />
      </button>
      <textarea
        className={done ? 'title-input done' : 'title-input'}
        value={title}
        rows={1}
        onChange={(event) => setTitle(event.target.value.replace(/\n/g, ''))}
        onBlur={saveTitle}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        aria-label="Task title"
        maxLength={255}
        disabled={!online}
      />
      <button
        type="button"
        className={task.important ? 'task-star on' : 'task-star'}
        aria-label={task.important ? 'Remove importance' : 'Mark important'}
        aria-pressed={task.important}
        onClick={() => update({ important: !task.important })}
        disabled={!online}
      >
        <Icon name="star" />
      </button>
    </section>
  )
}

export default TaskTitleCard

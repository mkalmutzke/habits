import { useState } from 'react'
import Icon from '../../shared/ui/Icon.jsx'
import { cleanText } from '../../shared/utils/text.js'

// "Add a task" field: type, press Enter, the field stays ready for the next one.
// `variant` 'amber' is the strong version on Today (mockup 1).
function AddTaskBar({ placeholder, onAdd, disabled = false, variant = 'plain' }) {
  const [title, setTitle] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = cleanText(title, 255)
    if (!trimmed) return
    onAdd(trimmed)
    setTitle('')
  }

  return (
    <form className={`add-task-bar variant-${variant}`} onSubmit={handleSubmit}>
      <Icon name="plusLarge" className="add-task-plus" />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={disabled ? 'Offline – adding needs a connection' : placeholder}
        aria-label={placeholder}
        maxLength={255}
        enterKeyHint="done"
        disabled={disabled}
      />
      <button type="submit" className="add-task-submit" disabled={disabled || !title.trim()} aria-label="Add task">
        ↵
      </button>
    </form>
  )
}

export default AddTaskBar

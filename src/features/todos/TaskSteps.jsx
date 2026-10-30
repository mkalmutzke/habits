import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { cleanText } from '../../shared/utils/text.js'

// The steps of a task: tick, delete, and a field to add the next one.
function TaskSteps({ task, todos }) {
  const online = useOnline()
  const [newStep, setNewStep] = useState('')
  const steps = todos.steps.filter((step) => step.task_id === task.id)

  function handleAddStep(event) {
    event.preventDefault()
    const trimmed = cleanText(newStep, 255)
    if (!trimmed) return
    todos.addStep(task.id, trimmed)
    setNewStep('')
  }

  return (
    <section className="detail-card" aria-label="Steps">
      {steps.length > 0 && (
        <ul className="step-list">
          {steps.map((step) => (
            <li key={step.id} className={step.done ? 'step done' : 'step'}>
              <button
                type="button"
                className="step-toggle"
                aria-pressed={step.done}
                onClick={() => todos.updateStep(step.id, { done: !step.done })}
                disabled={!online}
              >
                <span className="step-box" aria-hidden="true" />
                <span className="step-title">{step.title}</span>
              </button>
              <button
                type="button"
                className="step-delete"
                aria-label={`Delete step ${step.title}`}
                onClick={() => todos.deleteStep(step.id)}
                disabled={!online}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="step-add" onSubmit={handleAddStep}>
        <span aria-hidden="true">＋</span>
        <input
          value={newStep}
          onChange={(event) => setNewStep(event.target.value)}
          placeholder={steps.length ? 'Next step' : 'Add a step'}
          aria-label="Add a step"
          maxLength={255}
          disabled={!online}
        />
      </form>
    </section>
  )
}

export default TaskSteps

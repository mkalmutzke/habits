import { useEffect, useRef, useState } from 'react'
import Icon from '../../shared/ui/Icon.jsx'
import { describeSource, sourceOptions } from './sources.js'

// The small chip next to "ToDo's" (design v3 §2.3): shows which tasks are
// listed and opens a list of every source – All, Important, Planned, each
// group with its lists, then the other lists. Esc or a tap outside closes it.
function SourceSwitcher({ value, onChange, lists, groups }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const current = describeSource(value, lists, groups)
  const options = sourceOptions(lists, groups)

  useEffect(() => {
    if (!open) return
    function close(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  // when the list opens, the current choice gets the focus
  useEffect(() => {
    if (open) rootRef.current?.querySelector('[aria-current="true"]')?.focus()
  }, [open])

  function choose(id) {
    onChange(id)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      const items = [...rootRef.current.querySelectorAll('.source-option')]
      const index = items.indexOf(document.activeElement)
      const next = items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]
      next?.focus()
    }
  }

  return (
    <div ref={rootRef} className="source-switcher" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="source-button"
        aria-expanded={open}
        aria-controls="source-menu"
        aria-label={`Show tasks from: ${current.name}`}
        onClick={() => setOpen(!open)}
      >
        <span>
          <span className={`source-dot kind-${current.kind} color-${current.color}`} aria-hidden="true" />
          <span className="source-name">{current.name}</span>
          <Icon name="chevronDown" />
        </span>
      </button>
      {open && (
        <ul id="source-menu" className="source-menu" aria-label="Show tasks from">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className={option.nested ? 'source-option nested' : 'source-option'}
                aria-current={option.id === value}
                onClick={() => choose(option.id)}
              >
                <span className={`source-dot kind-${option.kind} color-${option.color}`} aria-hidden="true" />
                {option.name}
                {option.kind !== 'fixed' && <span className="source-kind">{option.kind}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SourceSwitcher

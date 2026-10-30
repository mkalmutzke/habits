import { useId } from 'react'
import Icon from './Icon.jsx'
import './CollapsibleSection.css'

// A foldable card (design v3.3 §3.1): the whole header bar – title, summary
// and chevron – is one button that folds and unfolds the card; extra
// buttons such as ＋ (`actions`) sit next to it. Used for Habits and ToDo's
// on What's up? and for Habits, Due & overdue and Shopping on Week.
// `state` is what `useSectionOpen` returns; `alwaysOpen` keeps the card open
// (e.g. the habit welcome card) and hides the chevron.
function CollapsibleSection({ state, title, summary, actions, alwaysOpen = false, className = '', children }) {
  const [open, setOpen] = state
  const id = useId()
  const isOpen = open || alwaysOpen

  return (
    <section className={`card-section ${isOpen ? 'open' : ''} ${className}`.trim()} aria-labelledby={`${id}-title`}>
      <div className="card-section-header">
        <h2 className="card-section-heading">
          <button
            type="button"
            className="card-section-toggle"
            aria-expanded={isOpen}
            aria-controls={`${id}-body`}
            onClick={() => setOpen(!open)}
            disabled={alwaysOpen}
          >
            <span id={`${id}-title`} className="card-section-title">
              {title}
            </span>
            {summary && <span className="card-section-summary">{summary}</span>}
            {!alwaysOpen && (
              <Icon name="chevronDown" className="section-chevron" />
            )}
          </button>
        </h2>
        {actions}
      </div>

      {isOpen && (
        <div id={`${id}-body`} className="card-section-body">
          {children}
        </div>
      )}
    </section>
  )
}

export default CollapsibleSection

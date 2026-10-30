import './ViewTabs.css'

// A segmented switch (tabs) with a highlight pill that slides to the selected
// option; the left/right arrow keys move between options too.
// Used for Today | Week and for the sections of the architecture overview.
function ViewTabs({ options, value, onChange, label, idPrefix = 'tab', controls, className = '' }) {
  const activeIndex = options.findIndex((option) => option.id === value)

  function handleKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = options[(activeIndex + step + options.length) % options.length].id
    onChange(next)
    event.currentTarget.querySelector(`#${idPrefix}-${next}`).focus()
  }

  return (
    <div
      className={`view-tabs ${className}`}
      role="tablist"
      aria-label={label}
      style={{ '--active': activeIndex, '--count': options.length }}
      onKeyDown={handleKeyDown}
    >
      <span className="view-tabs-pill" aria-hidden="true" />
      {options.map(({ id, label: optionLabel }) => (
        <button
          key={id}
          id={`${idPrefix}-${id}`}
          type="button"
          role="tab"
          aria-selected={value === id}
          aria-controls={controls}
          tabIndex={value === id ? 0 : -1}
          className={value === id ? 'view-tab active' : 'view-tab'}
          onClick={() => onChange(id)}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  )
}

export default ViewTabs

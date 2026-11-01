import Icon from './Icon.jsx'

// v3.6: a round icon button in the header (Garmin, the daily briefs) or on a
// card (the IBKR brief). `dot` shows a small amber dot – "new today, not
// opened yet"; it is also named in the button's label for screen readers.
function ToolButton({ icon, label, dot = false, onClick, className = 'icon-button' }) {
  return (
    <button type="button" className={`${className} tool-button`} aria-label={dot ? `${label} – new today` : label} onClick={onClick}>
      <Icon name={icon} />
      {dot && <span className="tool-dot" aria-hidden="true" />}
    </button>
  )
}

export default ToolButton

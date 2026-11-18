import Icon from './Icon.jsx'

// v3.6: a round icon button in the header (Garmin, the daily briefs) or on a
// card (the IBKR brief). `dot` shows a small amber dot – "new today, not
// opened yet"; it is also named in the button's label for screen readers.
// v3.8: `tone` ('ok', 'warn', 'down') colours the dot instead (server
// health), and `status` is what the label says about it.
function ToolButton({ icon, label, dot = false, tone = null, status = null, onClick, className = 'icon-button' }) {
  const spoken = status ? `${label} – ${status}` : dot ? `${label} – new today` : label
  return (
    <button type="button" className={`${className} tool-button`} aria-label={spoken} onClick={onClick}>
      <Icon name={icon} />
      {(dot || tone) && <span className={tone ? `tool-dot tone-${tone}` : 'tool-dot'} aria-hidden="true" />}
    </button>
  )
}

export default ToolButton

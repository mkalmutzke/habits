// One row in Settings: label, hint and an on/off switch.
function SwitchRow({ label, hint, on, onToggle, disabled, busy = false }) {
  return (
    <div className="settings-row">
      <span className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        <span className="settings-hint">{hint}</span>
      </span>
      <button type="button" className="switch" aria-pressed={on} aria-label={label} aria-busy={busy} onClick={onToggle} disabled={disabled} />
    </div>
  )
}

export default SwitchRow

import { useId, useState } from 'react'
import { cleanText } from '../../shared/utils/text.js'
import { CALENDAR_COLORS, calendarAddress } from './calendar.js'

// v3.9: the form to add a calendar (name, secret iCal address, colour) or,
// with `addressOnly`, to paste a new address for an existing one. The
// address is checked like the server does before it is sent.
function AddressForm({ submitLabel, onSubmit, onCancel, addressOnly = false, disabled = false, full = false }) {
  const id = useId()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [color, setColor] = useState('teal')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const cleanName = cleanText(name, 40)
  // the address is checked on submit, so a wrong one gets an explanation
  // instead of a silently disabled button
  const ready = address.trim() !== '' && (addressOnly || cleanName)

  async function handleSubmit(event) {
    event.preventDefault()
    const url = calendarAddress(address)
    if (!url) {
      setError('This address can’t be used. It must start with https:// or webcal:// and point to a calendar on the internet.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ name: cleanName, address: url, color })
      setName('')
      setAddress('')
    } catch {
      setError(full ? 'At most 10 calendars.' : 'Couldn’t save – please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="calendar-form" onSubmit={handleSubmit}>
      {!addressOnly && <p className="settings-row-label">{full ? 'At most 10 calendars' : 'Add a calendar'}</p>}
      {!addressOnly && (
        <div className="calendar-form-row">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name, e.g. Work" aria-label="Calendar name" maxLength={40} disabled={disabled} />
          <select className="input" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Calendar colour" disabled={disabled}>
            {CALENDAR_COLORS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="visually-hidden" htmlFor={`${id}-address`}>
        Secret address in iCal format
      </label>
      <input
        id={`${id}-address`}
        className="input"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
        maxLength={2000}
        disabled={disabled}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="calendar-form-actions">
        <button type="submit" className="button-primary" disabled={disabled || busy || !ready} aria-busy={busy || undefined}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default AddressForm

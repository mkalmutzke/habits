import { useId, useState } from 'react'
import { LIMITS, cleanEntry } from '../../../supabase/functions/_shared/briefPrefs.js'

// v3.9: a short list in Settings → Daily briefs (countries, job titles,
// regions, symbols, things to leave out): each entry a chip with ✕, a field
// to add one (Enter or ＋), at most 10 entries.
function ListField({ label, values, placeholder, ticker = false, onChange, disabled }) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const full = values.length >= LIMITS.entries

  function add(event) {
    event.preventDefault()
    const entry = cleanEntry(draft, ticker)
    if (!entry || full) return
    if (!values.some((value) => value.toLowerCase() === entry.toLowerCase())) onChange([...values, entry])
    setDraft('')
  }

  return (
    <div className="brief-field">
      <label className="brief-field-label" htmlFor={id}>
        {label}
      </label>
      {values.length > 0 && (
        <ul className="brief-chips" aria-label={label}>
          {values.map((value) => (
            <li key={value} className="brief-chip">
              {value}
              <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((other) => other !== value))} disabled={disabled}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="brief-add" onSubmit={add}>
        <input
          id={id}
          className="input compact"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={full ? `At most ${LIMITS.entries}` : placeholder}
          maxLength={ticker ? 12 : LIMITS.entry}
          disabled={disabled || full}
          enterKeyHint="done"
        />
        <button type="submit" className="button-ghost" disabled={disabled || full || !cleanEntry(draft, ticker)}>
          Add
        </button>
      </form>
    </div>
  )
}

export default ListField

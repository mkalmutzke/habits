import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import ConfirmDelete from '../../shared/ui/ConfirmDelete.jsx'
import { useToast } from '../../shared/ui/toast.js'
import { formatShortDate, toDateKey, toTimeKey } from '../../shared/utils/date.js'
import { cleanText } from '../../shared/utils/text.js'
import { NameField } from '../settings/HabitGroupSettings.jsx'
import SettingsSection from '../settings/SettingsSection.jsx'
import AddressForm from './AddressForm.jsx'
import { CALENDAR_COLORS } from './calendar.js'
import './calendar.css'

// v3.9 (owner): Settings → Calendars – add calendars by their secret iCal
// address (as many as you like, up to 10), rename them, pick a colour,
// switch one off, paste a new address, delete. The address is never shown
// again after saving: it works like a password.
function CalendarSettings({ calendars }) {
  const online = useOnline()
  const toast = useToast()
  const { sources, addCalendar, changeAddress, editCalendar, deleteCalendar, refresh } = calendars
  const [changing, setChanging] = useState(null)

  async function handleAdd({ name, address, color }) {
    await addCalendar({ name, address, color })
    toast.show(`${name} added – reading it…`)
    const result = await refresh()
    if (!result.ok) toast.show(result.message, { tone: 'error' })
  }

  async function handleChange(source, { address }) {
    await changeAddress(source.id, address)
    setChanging(null)
    toast.show('New address saved – reading it…')
    await refresh()
  }

  return (
    <SettingsSection id="calendars" title="Calendars" summary={`${sources.length} ${sources.length === 1 ? 'calendar' : 'calendars'}`}>
      <div className="settings-card">
        {sources.map((source) => (
          <div key={source.id} className="calendar-settings-row">
            <div className="calendar-settings-top">
              <span className={`calendar-dot color-${source.color}`} aria-hidden="true" />
              <NameField name={source.name} label={`Name of calendar ${source.name}`} onSave={(name) => editCalendar(source.id, { name: cleanText(name, 40) })} disabled={!online} />
              <button type="button" className="switch" aria-pressed={source.enabled} aria-label={`Show ${source.name}`} onClick={() => editCalendar(source.id, { enabled: !source.enabled })} disabled={!online} />
            </div>
            <p className={source.last_error ? 'settings-hint calendar-error' : 'settings-hint'}>{statusLine(source)}</p>
            <div className="calendar-settings-actions">
              <label className="calendar-color">
                Colour
                <select className="input compact" value={source.color} onChange={(event) => editCalendar(source.id, { color: event.target.value })} disabled={!online}>
                  {CALENDAR_COLORS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="button-ghost" onClick={() => setChanging(changing === source.id ? null : source.id)} disabled={!online} aria-expanded={changing === source.id}>
                New address
              </button>
              <ConfirmDelete label="Delete" question={`Delete ${source.name}? Its events leave Dawn.`} onConfirm={() => deleteCalendar(source.id)} disabled={!online} inline />
            </div>
            {changing === source.id && <AddressForm addressOnly submitLabel="Save address" onSubmit={(values) => handleChange(source, values)} onCancel={() => setChanging(null)} disabled={!online} />}
          </div>
        ))}
        <AddressForm submitLabel="Add calendar" onSubmit={handleAdd} disabled={!online || sources.length >= 10} full={sources.length >= 10} />
      </div>
      <div className="settings-hint calendar-help">
        <p>Where to find the secret address:</p>
        <ul>
          <li><b>Google Calendar</b> (on a computer): ⚙ Settings → your calendar on the left → Integrate calendar → “Secret address in iCal format”.</li>
          <li><b>iCloud</b>: Calendar app → share the calendar → Public calendar → copy the link (webcal://…).</li>
          <li><b>Outlook</b>: Settings → Calendar → Shared calendars → Publish a calendar → ICS link.</li>
        </ul>
        <p>Read-only: the app never changes your calendars. Anyone with the address can read the calendar, so keep it private; you can reset it at Google and paste the new one here.</p>
      </div>
    </SettingsSection>
  )
}

function statusLine(source) {
  if (!source.enabled) return 'Hidden on Dawn'
  if (source.last_error) return source.last_error
  if (!source.last_sync_at) return 'Not read yet'
  const at = new Date(source.last_sync_at)
  const when = toDateKey(at) === toDateKey() ? toTimeKey(at) : `${formatShortDate(toDateKey(at))} ${toTimeKey(at)}`
  return `${source.event_count} ${source.event_count === 1 ? 'event' : 'events'} in the next two weeks · read ${when}`
}

export default CalendarSettings

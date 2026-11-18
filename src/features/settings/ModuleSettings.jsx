import { useOnline } from '../../shared/data/hooks.js'
import { GARMIN_CHOICES, GARMIN_HINTS, garminDisplay, ibkrShown, serverShown } from './modules.js'
import SettingsSection from './SettingsSection.jsx'
import SwitchRow from './SwitchRow.jsx'

// v3.8 (owner): Settings → Modules – every user decides what the app shows.
// IBKR: the card on What's up? on or off. Garmin: off, an icon in the header
// that opens a window (as in v3.6), or a card on What's up?. Server health:
// an icon in the header with a status dot (off to start with).
function ModuleSettings({ settings, update }) {
  const online = useOnline()
  const garmin = garminDisplay(settings)
  const ibkr = ibkrShown(settings)
  const server = serverShown(settings)
  const shown = [ibkr, garmin !== 'off', server].filter(Boolean).length

  return (
    <SettingsSection id="modules" title="Modules" summary={`${shown} of 3 shown`}>
      <div className="settings-card">
        <SwitchRow
          label="IBKR portfolio"
          hint={ibkr ? 'Card on What’s up?' : 'Hidden'}
          on={ibkr}
          onToggle={() => update({ ibkr_display: ibkr ? 'off' : 'section' })}
          disabled={!online}
        />
        <div className="settings-row module-row">
          <span className="settings-row-text">
            <span className="settings-row-label" id="garmin-display-label">
              Garmin
            </span>
            <span className="settings-hint">{GARMIN_HINTS[garmin]}</span>
          </span>
          <div className="module-choice" role="group" aria-labelledby="garmin-display-label">
            {GARMIN_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                aria-pressed={garmin === choice.id}
                onClick={() => update({ garmin_display: choice.id })}
                disabled={!online}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
        <SwitchRow
          label="Server health"
          hint={server ? 'Icon in the header · servers under Settings → Servers' : 'Hidden'}
          on={server}
          onToggle={() => update({ server_display: server ? 'off' : 'icon' })}
          disabled={!online}
        />
      </div>
      <p className="settings-hint">Hiding a module only changes what you see; its data keeps arriving in the background.</p>
    </SettingsSection>
  )
}

export default ModuleSettings

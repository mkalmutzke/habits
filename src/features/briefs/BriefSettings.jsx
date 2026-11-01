import { useOnline } from '../../shared/data/hooks.js'
import SettingsSection from '../settings/SettingsSection.jsx'
import SwitchRow from '../settings/SwitchRow.jsx'
import { BRIEFS, isOn } from './briefs.js'

// Settings → Daily briefs (v3.6, owner): one switch per brief. Off hides its
// icon everywhere, and its morning run stops at once (brief-ingest answers
// "switched off" before any research is done).
function BriefSettings({ settings, update }) {
  const online = useOnline()
  const kinds = Object.keys(BRIEFS)
  const onCount = kinds.filter((kind) => isOn(settings, kind)).length

  return (
    <SettingsSection id="briefs" title="Daily briefs" summary={`${onCount} of ${kinds.length} on`}>
      <div className="settings-card">
        {kinds.map((kind) => {
          const on = isOn(settings, kind)
          return (
            <SwitchRow
              key={kind}
              label={BRIEFS[kind].settingsLabel}
              hint={on ? BRIEFS[kind].schedule : 'Off – icon hidden, no morning run'}
              on={on}
              onToggle={() => update({ [BRIEFS[kind].setting]: !on })}
              disabled={!online}
            />
          )
        })}
      </div>
      <p className="settings-hint">Each brief is written every morning by a Claude scheduled task on your Claude plan and is ready at 08:00.</p>
    </SettingsSection>
  )
}

export default BriefSettings

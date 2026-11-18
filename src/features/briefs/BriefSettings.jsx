import { useOnline } from '../../shared/data/hooks.js'
import SettingsSection from '../settings/SettingsSection.jsx'
import BriefCard from './BriefCard.jsx'
import { BRIEFS, isOn } from './briefs.js'

// Settings → Daily briefs (v3.6, owner): one switch per brief. Off hides its
// icon everywhere, and its morning run stops at once (brief-ingest answers
// "switched off" before any research is done).
// v3.9 (owner: "as configurable as possible"): each brief opens to its own
// settings – icon, name, countries / job titles / regions / symbols, topics,
// number of items, "about me" and anything else to follow (BriefCard).
function BriefSettings({ settings, update }) {
  const online = useOnline()
  const kinds = Object.keys(BRIEFS)
  const onCount = kinds.filter((kind) => isOn(settings, kind)).length

  return (
    <SettingsSection id="briefs" title="Daily briefs" summary={`${onCount} of ${kinds.length} on`}>
      <div className="settings-card">
        {kinds.map((kind) => (
          <BriefCard key={kind} kind={kind} settings={settings} update={update} disabled={!online} />
        ))}
      </div>
      <p className="settings-hint">
        Each brief is written every morning by a Claude scheduled task on your Claude plan and is ready at 08:00. Changes here apply from the next morning; the
        run times are set in the scheduled tasks.
      </p>
    </SettingsSection>
  )
}

export default BriefSettings

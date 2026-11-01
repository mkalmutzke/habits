import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'

// v3.6 (owner): every Settings section is a foldable card, folded each time
// the app starts; open or folded is remembered for the visit (like the cards
// on What's up?). `id` names it for that memory.
function SettingsSection({ id, title, summary, children }) {
  const state = useSectionOpen(`settings-${id}`)
  return (
    <CollapsibleSection state={state} className="settings-fold" title={title} summary={summary}>
      <div className="settings-fold-body">{children}</div>
    </CollapsibleSection>
  )
}

export default SettingsSection

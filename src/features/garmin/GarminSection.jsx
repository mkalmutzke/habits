import { useOnline } from '../../shared/data/hooks.js'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'
import Icon from '../../shared/ui/Icon.jsx'
import { useToast } from '../../shared/ui/toast.js'
import { GarminBody } from './GarminWindow.jsx'
import { headerSummary, summarize, viewDays } from './garmin.js'
import './garmin.css'

// v3.8 (owner): Garmin as a card on What's up? (Settings → Modules →
// Garmin: Section) – the same content as the Garmin window, folded at every
// app start like the other cards; Refresh sits in the card's header.
function GarminSection({ garmin, today }) {
  const online = useOnline()
  const toast = useToast()
  const section = useSectionOpen('garmin')
  const [showMonth, setShowMonth] = useSectionOpen('garmin-month')
  const { days, activities, loading, refresh, refreshing } = garmin
  const week = summarize(days, activities, viewDays('week', today))
  const hasData = days.length > 0

  async function handleRefresh() {
    const result = await refresh()
    toast.show(result.message, result.ok ? {} : { tone: 'error' })
  }

  return (
    <CollapsibleSection
      state={section}
      className="garmin-section"
      title="Garmin"
      summary={hasData ? headerSummary(week) : loading ? null : 'no data yet'}
      actions={
        <button type="button" className="section-icon-button" aria-label="Refresh Garmin" onClick={handleRefresh} disabled={!online || refreshing} aria-busy={refreshing}>
          <Icon name="refresh" className={refreshing ? 'spinning' : undefined} />
        </button>
      }
    >
      {hasData ? (
        <GarminBody days={days} activities={activities} week={week} showMonth={showMonth} setShowMonth={setShowMonth} today={today} />
      ) : (
        <p className="empty-note">{loading ? 'Loading…' : 'No data from Garmin yet. It appears within half an hour once the personal Garmin key is entered in the Supabase dashboard.'}</p>
      )}
    </CollapsibleSection>
  )
}

export default GarminSection

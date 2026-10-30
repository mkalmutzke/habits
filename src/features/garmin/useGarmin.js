import { useTable } from '../../shared/data/hooks.js'

// The owner's Garmin data (v3.5): daily summaries and activities as stored by
// garmin-sync. Read-only – the app never changes these tables.
export function useGarmin() {
  const days = useTable('garmin_days')
  const activities = useTable('garmin_activities')
  return { days: days.rows, activities: activities.rows, loading: days.loading || activities.loading }
}

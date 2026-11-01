import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTable } from '../../shared/data/hooks.js'
import { supabase } from '../../shared/data/supabaseClient.js'

// The owner's Garmin data (v3.5): daily summaries and activities as stored by
// garmin-sync. Read-only – the app never changes these tables.
// v3.6: `refresh()` asks garmin-sync to fetch now (the Refresh button in the
// Garmin window) and then loads both tables again. Returns a short message.
export function useGarmin() {
  const days = useTable('garmin_days')
  const activities = useTable('garmin_activities')
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  async function refresh() {
    setRefreshing(true)
    try {
      const { data, error } = await supabase.functions.invoke('garmin-sync', { body: {} })
      if (error) {
        const detail = await error.context?.json?.().catch(() => null)
        return { ok: false, message: detail?.error ?? 'Couldn’t reach Garmin – please try again later.' }
      }
      if (data?.skipped) return { ok: false, message: 'Garmin isn’t set up yet.' }
      await queryClient.invalidateQueries({ queryKey: ['garmin_days'] })
      await queryClient.invalidateQueries({ queryKey: ['garmin_activities'] })
      return { ok: true, message: 'Garmin data updated.' }
    } finally {
      setRefreshing(false)
    }
  }

  return { days: days.rows, activities: activities.rows, loading: days.loading || activities.loading, refresh, refreshing }
}

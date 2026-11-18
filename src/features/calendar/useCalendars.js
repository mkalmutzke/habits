import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { localOnly, remove, update } from '../../shared/data/changes.js'
import { useSave, useTable } from '../../shared/data/hooks.js'
import { supabase } from '../../shared/data/supabaseClient.js'
import { lastRead } from './calendar.js'

// The user's calendars and their events (v3.9). The events are written by
// calendar-sync only; the app reads them. Adding a calendar and changing its
// address go through database functions, because the address is kept where
// the app can't read it back.
export function useCalendars() {
  const sourceRows = useTable('calendar_sources')
  const eventRows = useTable('calendar_events')
  const save = useSave()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const sources = useMemo(() => [...sourceRows.rows].sort((a, b) => a.created_at.localeCompare(b.created_at)), [sourceRows.rows])
  const newest = lastRead(sources)

  // a sync changes the calendars' "last read" (that arrives live) – then the
  // events are loaded again (they send no live messages of their own)
  useEffect(() => {
    if (newest) queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
  }, [newest, queryClient])

  // Reads the calendars now. Returns { ok, message } for a toast.
  async function refresh() {
    setRefreshing(true)
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', { body: {} })
      if (error) {
        const detail = await error.context?.json?.().catch(() => null)
        return { ok: false, message: detail?.error ?? 'Couldn’t read the calendars – please try again later.' }
      }
      await queryClient.invalidateQueries({ queryKey: ['calendar_sources'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      return data?.failed ? { ok: false, message: `${data.failed} of ${data.calendars} calendars couldn’t be read – see Settings → Calendars.` } : { ok: true, message: 'Calendars updated.' }
    } finally {
      setRefreshing(false)
    }
  }

  // → the new calendar's id; throws when the database refuses it
  async function addCalendar({ name, color, address }) {
    const { data, error } = await supabase.rpc('add_calendar', { cal_name: name, cal_color: color, cal_address: address })
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: ['calendar_sources'] })
    return data
  }

  async function changeAddress(id, address) {
    const { error } = await supabase.rpc('change_calendar_address', { source: id, cal_address: address })
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: ['calendar_sources'] })
  }

  // values: { name, color, enabled } (any of them)
  function editCalendar(id, values) {
    save(update('calendar_sources', id, values))
  }

  // its events go with it (the database does that by itself)
  function deleteCalendar(id) {
    save([remove('calendar_sources', id), localOnly(remove('calendar_events', { source_id: id }))])
  }

  return { sources, events: eventRows.rows, loading: sourceRows.loading || eventRows.loading, refreshing, refresh, addCalendar, changeAddress, editCalendar, deleteCalendar }
}

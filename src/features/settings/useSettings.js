import { useEffect, useRef } from 'react'
import { upsert } from '../../shared/data/changes.js'
import { useOnline, useSave, useTable } from '../../shared/data/hooks.js'

export const DEFAULT_SETTINGS = {
  time_zone: 'UTC',
  inapp_on: true,
  email_on: false,
  default_remind_time: '09:00:00',
  quiet_start: null,
  quiet_end: null,
  show_deleted_tasks: true,
  // v3.8: breaks per habit and month; null = no limit
  habit_break_limit: null,
  // v3.8: modules shown (Settings → Modules)
  ibkr_display: 'section',
  garmin_display: 'icon',
  server_display: 'off',
  // v3.9: settings of the daily briefs ({} = as before)
  brief_prefs: {},
  // v3.9: the Calendar card on Dawn
  calendar_display: 'section',
}

// This user's settings row (or the defaults until it exists) and a way to change it.
// v3.9 (found by CI): two quick changes in a row could overwrite each other,
// because every save sent the WHOLE row as it was at the last render, and the
// screen copy only updates a moment after a save. Now a save sends only the
// columns it changes (the database keeps the others), and changes still on
// their way count as current: `update(current => values)` builds on them
// (e.g. one field inside brief_prefs).
export function useSettings(userId) {
  const { rows, loading } = useTable('user_settings')
  const save = useSave()
  const settings = { ...DEFAULT_SETTINGS, ...rows[0] }
  // what this view saved since the stored row last changed
  const pending = useRef({ row: null, values: {} })
  const row = rows[0]

  function update(values) {
    // a newer stored row already contains what was saved before
    if (pending.current.row !== row) pending.current = { row, values: {} }
    const current = { ...settings, ...pending.current.values }
    const next = typeof values === 'function' ? values(current) : values
    pending.current.values = { ...pending.current.values, ...next }
    return save(upsert('user_settings', { ...next, user_id: userId }))
  }

  return { settings, exists: rows.length > 0, loading, update }
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// Keeps the stored time zone equal to this device's, so the server sends
// reminders and respects quiet hours in your local time.
export function useTimeZoneSetting(userId) {
  const { settings, exists, loading, update } = useSettings(userId)
  const online = useOnline()
  const zone = deviceTimeZone()
  const needsUpdate = !loading && online && (!exists || settings.time_zone !== zone)
  // one try per time zone and app start – a failing save must not repeat in a loop
  const tried = useRef(null)

  useEffect(() => {
    if (!needsUpdate || tried.current === zone) return
    tried.current = zone
    update({ time_zone: zone })
    // only when the need changes; `update` is a new function on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsUpdate, zone])
}

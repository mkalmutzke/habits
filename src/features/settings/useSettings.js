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
}

// This user's settings row (or the defaults until it exists) and a way to change it.
export function useSettings(userId) {
  const { rows, loading } = useTable('user_settings')
  const save = useSave()
  const settings = { ...DEFAULT_SETTINGS, ...rows[0] }

  function update(values) {
    return save(upsert('user_settings', { ...settings, ...values, user_id: userId }))
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

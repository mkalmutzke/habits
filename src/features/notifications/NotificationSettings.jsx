import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { supabase } from '../../shared/data/supabaseClient.js'
import { useToast } from '../../shared/ui/toast.js'
import SwitchRow from '../settings/SwitchRow.jsx'
import { disablePush, enablePush, pushPermission, pushSupported } from './pushDevice.js'
import { describeReminder } from './reminderTime.js'
import './notifications.css'

// "Reminders" in Settings (mockup 5): in-app, push on this device, email,
// default time, quiet hours, a test button and the latest deliveries.
// Changes are saved at once and apply on all devices (except push).
function NotificationSettings({ user, settings, update, pushOnThisDevice }) {
  const online = useOnline()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(null)
  const quietOn = Boolean(settings.quiet_start && settings.quiet_end)

  async function togglePush() {
    setBusy('push')
    try {
      if (pushOnThisDevice) await disablePush()
      else await enablePush(user.id)
      toast.show(pushOnThisDevice ? 'Push is off on this device.' : 'Push is on for this device.')
    } catch (error) {
      toast.show(error.message ?? 'Couldn’t change push.', { tone: 'error' })
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['push_subscriptions'] })
      setBusy(null)
    }
  }

  async function sendTest() {
    setBusy('test')
    try {
      const { data, error } = await supabase.functions.invoke('send-test-notification', { body: {} })
      if (error) {
        const detail = await error.context?.json?.().catch(() => null)
        throw new Error(detail?.error ?? 'Couldn’t send the test.')
      }
      const parts = []
      if (data.push.devices === 0) parts.push('no device with push switched on')
      else parts.push(`push sent to ${data.push.sent} of ${data.push.devices} ${data.push.devices === 1 ? 'device' : 'devices'}`)
      if (data.email !== 'skipped') parts.push(`email ${data.email}`)
      toast.show(`Test: ${parts.join(', ')}.`)
      queryClient.invalidateQueries({ queryKey: ['notification_log', 'recent'] })
    } catch (error) {
      toast.show(error.message, { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const pushHint = !pushSupported()
    ? 'This browser can’t receive push notifications.'
    : pushPermission() === 'denied'
      ? 'Notifications are blocked for this site – allow them in the browser’s site settings.'
      : 'Notifications on this phone or computer, also when the app is closed.'

  return (
    <section className="settings-section" aria-labelledby="reminders-heading">
      <h2 id="reminders-heading" className="section-label">
        Reminders
      </h2>
      <div className="settings-card">
        <SwitchRow
          label="In-app pop-ups"
          hint="A banner while the app is open."
          on={settings.inapp_on}
          onToggle={() => update({ inapp_on: !settings.inapp_on })}
          disabled={!online}
        />
        <SwitchRow
          label="Push on this device"
          hint={pushHint}
          on={pushOnThisDevice}
          onToggle={togglePush}
          disabled={!online || busy === 'push' || !pushSupported()}
          busy={busy === 'push'}
        />
        <SwitchRow
          label="Email"
          hint={`To ${user.email}. Uses no extra app or device.`}
          on={settings.email_on}
          onToggle={() => update({ email_on: !settings.email_on })}
          disabled={!online}
        />
        <SwitchRow
          label="Quiet hours"
          hint="No push or email in this time; they arrive when it ends."
          on={quietOn}
          onToggle={() => update(quietOn ? { quiet_start: null, quiet_end: null } : { quiet_start: '22:00:00', quiet_end: '07:00:00' })}
          disabled={!online}
        />
        {quietOn && (
          <div className="settings-row quiet-row">
            <label className="inline-field">
              <span>From</span>
              <input
                type="time"
                className="input compact"
                value={settings.quiet_start.slice(0, 5)}
                onChange={(event) => event.target.value && update({ quiet_start: `${event.target.value}:00` })}
                disabled={!online}
              />
            </label>
            <label className="inline-field">
              <span>to</span>
              <input
                type="time"
                className="input compact"
                value={settings.quiet_end.slice(0, 5)}
                onChange={(event) => event.target.value && update({ quiet_end: `${event.target.value}:00` })}
                disabled={!online}
              />
            </label>
          </div>
        )}
      </div>
      <div className="settings-actions">
        <button type="button" className="button-outline" onClick={sendTest} disabled={!online || busy !== null} aria-busy={busy === 'test'}>
          {busy === 'test' && <span className="spinner" aria-hidden="true" />}
          Send a test notification
        </button>
      </div>
      <RecentDeliveries />
    </section>
  )
}


const RESULT_TEXT = { sent: 'sent', failed: 'failed', skipped: 'skipped' }
const CHANNEL_TEXT = { push: 'Push', email: 'Email', inapp: 'In app', test: 'Test' }

// The last few entries of the delivery log – helps to see whether push works.
function RecentDeliveries() {
  const { data = [] } = useQuery({
    queryKey: ['notification_log', 'recent'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('notification_log')
        .select('id, channel, result, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return rows
    },
  })
  if (data.length === 0) return null
  return (
    <details className="recent-deliveries">
      <summary>Latest deliveries</summary>
      <ul>
        {data.map((row) => (
          <li key={row.id}>
            <span>{describeReminder(row.created_at)}</span>
            <span>
              {CHANNEL_TEXT[row.channel]} · {RESULT_TEXT[row.result]}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default NotificationSettings

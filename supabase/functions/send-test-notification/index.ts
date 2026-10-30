// send-test-notification: the "Send a test notification" button in Settings.
// Supabase checks the user's sign-in token before the function runs; the
// function looks up who it is. Sends one push to each of the user's devices
// (and an email, if switched on – increment 5). At most one test per minute.
import { db, eq, userFromToken } from '../_shared/admin.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { sendEmailReminder } from '../_shared/email.ts'
import { pushConfigured, sendPush } from '../_shared/push.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const user = await userFromToken((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''))
  if (!user) return json({ error: 'Not signed in' }, 401)
  const byUser = `user_id=${eq(user.id)}`

  // rate limit: one test per minute
  const since = encodeURIComponent(new Date(Date.now() - 60_000).toISOString())
  const recent = await db.select('notification_log', `select=id&${byUser}&channel=eq.test&created_at=gte.${since}&limit=1`)
  if (recent.length > 0) return json({ error: 'Please wait a minute before the next test.' }, 429)

  const report = { push: { devices: 0, sent: 0, failed: 0 }, pushConfigured: pushConfigured(), email: 'skipped' }

  if (report.pushConfigured) {
    const devices = await db.select('push_subscriptions', `select=id,endpoint,p256dh,auth&${byUser}`)
    report.push.devices = devices.length
    for (const device of devices) {
      const { result } = await sendPush(device, {
        title: 'Test notification',
        body: 'Reminders reach this device. 👍',
        url: '/#/settings',
        tag: 'test',
      })
      if (result === 'sent') report.push.sent++
      else if (result === 'gone') await db.remove('push_subscriptions', `id=${eq(device.id)}`)
      else report.push.failed++
    }
  }

  const [settings] = await db.select('user_settings', `select=email_on&${byUser}`)
  if (settings?.email_on) {
    const { result } = await sendEmailReminder(user.id, { title: 'Test notification', when: '', taskId: '' })
    report.email = result
  }

  await db.insert('notification_log', {
    user_id: user.id,
    channel: 'test',
    result: report.push.sent > 0 || report.email === 'sent' ? 'sent' : 'skipped',
    detail: JSON.stringify(report).slice(0, 500),
  })
  return json(report)
})

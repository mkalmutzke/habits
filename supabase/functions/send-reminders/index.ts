// send-reminders: called every minute by the database scheduler
// (pg_cron). Claims the due reminders, respects quiet hours, sends push (and
// email, increment 5), writes the delivery log and marks each reminder as
// sent, to be retried, or failed. v3: also the daily habit reminders.
import { db, eq } from '../_shared/admin.ts'
import { sendEmailReminder } from '../_shared/email.ts'
import { pushConfigured, sendPush } from '../_shared/push.ts'
import { formatTime, outcome, quietUntil } from '../_shared/schedule.js'

type Due = {
  reminder_id: string
  user_id: string
  task_id: string
  remind_at: string
  channels: string[]
  attempts: number
  task_title: string
  task_done: boolean
  time_zone: string
  inapp_on: boolean
  email_on: boolean
  quiet_start: string | null
  quiet_end: string | null
}

type HabitDue = {
  reminder_id: string
  user_id: string
  habit_id: string
  habit_name: string
  habit_emoji: string
  local_day: string
  channels: string[]
  attempts: number
  time_zone: string
  inapp_on: boolean
  email_on: boolean
  quiet_start: string | null
  quiet_end: string | null
}

type Result = 'sent' | 'failed' | 'skipped'
type Summary = Record<'claimed' | 'sent' | 'retry' | 'failed' | 'postponed' | 'cancelled' | 'habits', number>

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Only the scheduler knows the token (it lives in the database's Vault).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  let tokenOk = false
  try {
    tokenOk = token.length > 0 && (await db.rpc('check_cron_token', { token })) === true
  } catch {
    tokenOk = false
  }
  if (!tokenOk) return new Response('Unauthorized', { status: 401 })

  const due: Due[] = await db.rpc('claim_due_reminders', { max_count: 50 })
  const now = new Date()
  const summary: Summary = { claimed: due.length, sent: 0, retry: 0, failed: 0, postponed: 0, cancelled: 0, habits: 0 }

  for (const reminder of due) {
    try {
      await handle(reminder, now, summary)
    } catch (err) {
      // never let one reminder stop the others; it is picked up again later
      await db.update('todo_reminders', `id=${eq(reminder.reminder_id)}`, {
        status: 'pending',
        last_error: String(err).slice(0, 300),
      })
      summary.retry++
    }
  }

  // v3: daily habit reminders (design v3 §5.2)
  const habitsDue: HabitDue[] = await db.rpc('claim_due_habit_reminders', { max_count: 50 })
  summary.habits = habitsDue.length
  for (const reminder of habitsDue) {
    try {
      await handleHabit(reminder, now, summary)
    } catch (err) {
      // let it be claimed again next minute (the try is counted)
      await db.update('habit_reminders', `id=${eq(reminder.reminder_id)}`, { claimed_at: null })
      console.error('habit reminder', reminder.reminder_id, String(err).slice(0, 300))
      summary.retry++
    }
  }
  return Response.json(summary)
})

// One habit reminder: at most once a day, only if the habit is still not
// done (the claim checked that). Quiet hours move it to their end.
async function handleHabit(reminder: HabitDue, now: Date, summary: Summary) {
  const byId = `id=${eq(reminder.reminder_id)}`
  const log = (channel: string, result: Result, detail = '') =>
    db.insert('notification_log', {
      user_id: reminder.user_id,
      habit_id: reminder.habit_id,
      channel,
      result,
      detail: detail.slice(0, 500),
    })

  const until = quietUntil(now, reminder.time_zone, reminder.quiet_start, reminder.quiet_end)
  if (until) {
    await db.update('habit_reminders', byId, { claimed_at: null, retry_at: until.toISOString(), attempts: reminder.attempts - 1 })
    summary.postponed++
    return
  }

  const title = `${reminder.habit_emoji} ${reminder.habit_name}`
  const when = formatTime(now, reminder.time_zone)
  const results: Record<string, Result> = {}
  // in-app: shown by the open app itself
  if (reminder.channels.includes('inapp')) results.inapp = 'skipped'
  if (reminder.channels.includes('push')) {
    results.push = await pushHabit(reminder, title, log)
  }
  if (reminder.channels.includes('email')) {
    if (!reminder.email_on) {
      results.email = 'skipped'
      await log('email', 'skipped', 'email reminders are switched off')
    } else {
      const { result, detail } = await sendEmailReminder(reminder.user_id, { title, when, habitId: reminder.habit_id })
      results.email = result
      await log('email', result, detail)
    }
  }

  const next = outcome(results, reminder.attempts, now)
  if (next.status === 'pending') {
    await db.update('habit_reminders', byId, { claimed_at: null, retry_at: next.retryAt.toISOString() })
    summary.retry++
    return
  }
  // sent, or given up for today: done for this day
  await db.update('habit_reminders', byId, { claimed_at: null, retry_at: null, attempts: 0, last_sent_on: reminder.local_day })
  if (next.status === 'sent') summary.sent++
  else summary.failed++
}

async function pushHabit(reminder: HabitDue, title: string, log: (channel: string, result: Result, detail?: string) => Promise<unknown>): Promise<Result> {
  if (!pushConfigured()) {
    await log('push', 'skipped', 'push is not configured on the server')
    return 'skipped'
  }
  const devices = await db.select('push_subscriptions', `select=id,endpoint,p256dh,auth&user_id=${eq(reminder.user_id)}`)
  if (!devices.length) {
    await log('push', 'skipped', 'no device with push switched on')
    return 'skipped'
  }
  let any = false
  for (const device of devices) {
    const { result, detail } = await sendPush(device, {
      title,
      body: 'Not done yet today',
      url: '/#/today',
      tag: `habit-${reminder.habit_id}-${reminder.local_day}`,
    })
    if (result === 'gone') {
      await db.remove('push_subscriptions', `id=${eq(device.id)}`)
      await log('push', 'skipped', `${detail} – device removed`)
      continue
    }
    if (result === 'sent') {
      any = true
      await db.update('push_subscriptions', `id=${eq(device.id)}`, { last_used_at: new Date().toISOString() })
    }
    await log('push', result, detail)
  }
  return any ? 'sent' : 'failed'
}

async function handle(reminder: Due, now: Date, summary: Summary) {
  const byId = `id=${eq(reminder.reminder_id)}`
  const log = (channel: string, result: Result, detail = '') =>
    db.insert('notification_log', {
      user_id: reminder.user_id,
      reminder_id: reminder.reminder_id,
      task_id: reminder.task_id,
      channel,
      result,
      detail: detail.slice(0, 500),
    })

  // task already done: nothing to remind of
  if (reminder.task_done) {
    await db.update('todo_reminders', byId, { status: 'cancelled' })
    summary.cancelled++
    return
  }

  // quiet hours: move to their end (this attempt doesn't count)
  const until = quietUntil(now, reminder.time_zone, reminder.quiet_start, reminder.quiet_end)
  if (until) {
    await db.update('todo_reminders', byId, { status: 'pending', remind_at: until.toISOString(), attempts: reminder.attempts - 1 })
    summary.postponed++
    return
  }

  const results: Record<string, Result> = {}
  const when = formatTime(new Date(reminder.remind_at), reminder.time_zone)

  // in-app: shown by the open app itself; nothing to send from here
  if (reminder.channels.includes('inapp')) results.inapp = 'skipped'
  if (reminder.channels.includes('push')) results.push = await pushToDevices(reminder, when, log)
  if (reminder.channels.includes('email')) {
    if (!reminder.email_on) {
      results.email = 'skipped'
      await log('email', 'skipped', 'email reminders are switched off')
    } else {
      const { result, detail } = await sendEmailReminder(reminder.user_id, { title: reminder.task_title, when, taskId: reminder.task_id })
      results.email = result
      await log('email', result, detail)
    }
  }

  const next = outcome(results, reminder.attempts, now)
  if (next.status === 'sent') {
    await db.update('todo_reminders', byId, { status: 'sent', sent_at: now.toISOString(), last_error: null })
    summary.sent++
  } else if (next.status === 'pending') {
    await db.update('todo_reminders', byId, { status: 'pending', remind_at: next.retryAt.toISOString(), last_error: 'retry' })
    summary.retry++
  } else {
    await db.update('todo_reminders', byId, { status: 'failed', last_error: 'all channels failed' })
    summary.failed++
  }
}

// Push to every device of the user that has push switched on.
async function pushToDevices(reminder: Due, when: string, log: (channel: string, result: Result, detail?: string) => Promise<unknown>): Promise<Result> {
  if (!pushConfigured()) {
    await log('push', 'skipped', 'push is not configured on the server')
    return 'skipped'
  }
  const devices = await db.select('push_subscriptions', `select=id,endpoint,p256dh,auth&user_id=${eq(reminder.user_id)}`)
  if (!devices.length) {
    await log('push', 'skipped', 'no device with push switched on')
    return 'skipped'
  }
  let any = false
  for (const device of devices) {
    const { result, detail } = await sendPush(device, {
      title: reminder.task_title,
      body: `Reminder · ${when}`,
      url: `/#/task/${reminder.task_id}`,
      tag: reminder.reminder_id,
    })
    if (result === 'gone') {
      await db.remove('push_subscriptions', `id=${eq(device.id)}`)
      await log('push', 'skipped', `${detail} – device removed`)
      continue
    }
    if (result === 'sent') {
      any = true
      await db.update('push_subscriptions', `id=${eq(device.id)}`, { last_used_at: new Date().toISOString() })
    }
    await log('push', result, detail)
  }
  return any ? 'sent' : 'failed'
}

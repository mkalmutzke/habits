import { db, eq, userEmail } from './admin.ts'
import { DAILY_EMAIL_LIMIT, reminderEmail, sendViaResend } from './emailTemplate.js'

// Reminder emails via Resend. Settings of the Edge
// Functions (never in the code): RESEND_API_KEY, EMAIL_FROM (e.g.
// "Habits <reminders@habits.mkalmutzke.com>") and APP_URL (where links point).
// Without them emails are skipped – not failed – so push and in-app still work.
// Emails only ever go to the account's own address.
export async function sendEmailReminder(
  userId: string,
  message: { title: string; when: string; taskId?: string; habitId?: string },
): Promise<{ result: 'sent' | 'failed' | 'skipped'; detail: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const from = Deno.env.get('EMAIL_FROM') ?? ''
  if (!apiKey || !from) return { result: 'skipped', detail: 'email is not set up on the server' }

  // protection for the free tier (100/day): at most 50 emails per user and day
  const since = encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  const recent = await db.select(
    'notification_log',
    `select=id&user_id=${eq(userId)}&channel=eq.email&result=eq.sent&created_at=gte.${since}&limit=${DAILY_EMAIL_LIMIT}`,
  )
  if (recent.length >= DAILY_EMAIL_LIMIT) return { result: 'skipped', detail: 'daily email limit reached' }

  const email = reminderEmail({ ...message, appUrl: Deno.env.get('APP_URL') ?? 'https://habits.mkalmutzke.com' })
  return sendViaResend({ apiKey, from, to: await userEmail(userId), email })
}

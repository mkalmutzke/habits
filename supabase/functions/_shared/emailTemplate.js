// Reminder emails: the content and the call to Resend.
// Plain JavaScript without imports, so Deno (Edge Functions) and Vitest
// (emailTemplate.test.js) use the same code.

export const DAILY_EMAIL_LIMIT = 50

// Task titles come from the user: never put them into HTML unescaped.
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Subject, HTML and plain-text version of one reminder email.
// taskId and habitId empty = the test email from Settings; habitId = the
// daily reminder of a habit (v3), which links to What's up?.
export function reminderEmail({ title, when, taskId, habitId, appUrl }) {
  const base = String(appUrl || 'https://habits.mkalmutzke.com').replace(/\/+$/, '')
  const isHabit = Boolean(habitId)
  const isTest = !taskId && !isHabit
  const link = isTest ? `${base}/#/settings` : isHabit ? `${base}/#/today` : `${base}/#/task/${encodeURIComponent(taskId)}`
  const settings = `${base}/#/settings`
  const subject = isTest ? 'Test: reminder emails work' : isHabit ? `⏰ ${title} · not done yet today` : `⏰ ${title}${when ? ` · ${when}` : ''}`
  const lead = isTest ? 'Reminder emails reach this address. 👍' : isHabit ? `Not done yet today${when ? ` · ${when}` : ''}` : `Reminder${when ? ` for ${when}` : ''}`
  const heading = isTest ? 'Test notification' : title
  const action = isTest || isHabit ? 'Open the app' : 'Open the task'

  const text = [
    heading,
    lead,
    '',
    `${action}: ${link}`,
    '',
    `You get this email because email reminders are on. Change it in Settings: ${settings}`,
  ].join('\n')

  // Simple, accessible HTML: one column, real text (no images), high contrast,
  // works in dark and light mail apps.
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f6f2ea;font-family:Arial,Helvetica,sans-serif;color:#1d1b17">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #e3ddd3">
    <p style="margin:0 0 4px;font-size:13px;color:#5a554d">Habits · ${escapeHtml(lead)}</p>
    <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#13120f">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#c68a3d;color:#13120f;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">${action}</a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#5a554d">You get this email because email reminders are on.
      <a href="${escapeHtml(settings)}" style="color:#8a5a20">Change notifications</a></p>
  </div>
</body>
</html>`

  return { subject, text, html }
}

// Sends one email through Resend. `fetchFn` is passed in so tests can
// simulate Resend. Never throws; returns sent / failed / skipped.
export async function sendViaResend({ apiKey, from, to, email, fetchFn = fetch }) {
  if (!apiKey || !from) return { result: 'skipped', detail: 'email is not set up on the server' }
  if (!to) return { result: 'failed', detail: 'no email address for this account' }
  try {
    const response = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html, text: email.text }),
    })
    if (response.ok) return { result: 'sent', detail: `email ${response.status}` }
    const body = await response.text()
    return { result: 'failed', detail: `email ${response.status} ${body.slice(0, 200)}` }
  } catch (error) {
    return { result: 'failed', detail: `email error ${String(error).slice(0, 200)}` }
  }
}

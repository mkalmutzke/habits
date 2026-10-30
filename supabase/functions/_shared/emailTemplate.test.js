import { describe, expect, it, vi } from 'vitest'
import { escapeHtml, reminderEmail, sendViaResend } from './emailTemplate.js'

describe('reminderEmail', () => {
  it('a habit reminder (v3): "not done yet", link to What’s up?', () => {
    const email = reminderEmail({ title: '🐕 Walk Bello', when: '18:30', habitId: 'h1', appUrl: 'https://habits.mkalmutzke.com' })
    expect(email.subject).toBe('⏰ 🐕 Walk Bello · not done yet today')
    expect(email.html).toContain('href="https://habits.mkalmutzke.com/#/today"')
    expect(email.text).toContain('Not done yet today · 18:30')
    expect(email.text).toContain('Open the app: https://habits.mkalmutzke.com/#/today')
  })

  it('a reminder: subject with time, link to the task, plain-text version', () => {
    const email = reminderEmail({ title: 'Call the dentist', when: '14:00', taskId: 'abc-123', appUrl: 'https://habits.mkalmutzke.com/' })
    expect(email.subject).toBe('⏰ Call the dentist · 14:00')
    expect(email.html).toContain('href="https://habits.mkalmutzke.com/#/task/abc-123"')
    expect(email.text).toContain('Open the task: https://habits.mkalmutzke.com/#/task/abc-123')
    expect(email.text).toContain('https://habits.mkalmutzke.com/#/settings')
  })

  it('task titles cannot inject HTML', () => {
    const email = reminderEmail({ title: '<img src=x onerror=alert(1)> & "quotes"', when: '09:00', taskId: 't' })
    expect(email.html).not.toContain('<img')
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;')
  })

  it('the test email links to Settings', () => {
    const email = reminderEmail({ title: 'Test notification', when: '', taskId: '', appUrl: 'https://preview.example' })
    expect(email.subject).toBe('Test: reminder emails work')
    expect(email.html).toContain('href="https://preview.example/#/settings"')
  })

  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})

describe('sendViaResend (Resend simulated)', () => {
  const email = { subject: 'S', html: '<p>H</p>', text: 'T' }

  it('posts to Resend with the key and reports sent', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }))
    const result = await sendViaResend({ apiKey: 'test-key', from: 'Habits <reminders@habits.mkalmutzke.com>', to: 'me@example.com', email, fetchFn })
    expect(result.result).toBe('sent')
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer test-key')
    expect(JSON.parse(init.body)).toEqual({ from: 'Habits <reminders@habits.mkalmutzke.com>', to: ['me@example.com'], subject: 'S', html: '<p>H</p>', text: 'T' })
  })

  it('reports Resend errors (e.g. daily limit) as failed, so they are retried', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{"message":"rate limit"}', { status: 429 }))
    const result = await sendViaResend({ apiKey: 'k', from: 'f', to: 't@example.com', email, fetchFn })
    expect(result).toEqual({ result: 'failed', detail: 'email 429 {"message":"rate limit"}' })
  })

  it('network errors don\'t throw', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'))
    expect((await sendViaResend({ apiKey: 'k', from: 'f', to: 't@example.com', email, fetchFn })).result).toBe('failed')
  })

  it('without server settings: skipped, nothing sent', async () => {
    const fetchFn = vi.fn()
    expect((await sendViaResend({ apiKey: '', from: '', to: 't@example.com', email, fetchFn })).result).toBe('skipped')
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

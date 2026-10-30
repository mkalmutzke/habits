import { expect, test } from '@playwright/test'
import { createUser, openSignedIn, restAs } from './helpers.js'

// Test plan v3 TS-R: daily habit reminders – set in the habit dialog, sent by
// the server (the local scheduler calls send-reminders every minute).

const pad = (number) => String(number).padStart(2, '0')

test('TS-R1 the habit dialog saves a daily reminder with time and channels', async ({ page }) => {
  const user = await createUser('habit-remind')
  await openSignedIn(page, user)
  await page.getByRole('button', { name: 'Add your first habit' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Habit name').fill('Vitamin D')
  await dialog.getByRole('button', { name: 'Daily reminder' }).click()
  await dialog.getByLabel('Time').fill('18:30')
  await dialog.getByRole('button', { name: 'Email' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect
    .poll(async () => (await restAs(user, 'habit_reminders?select=remind_time,channels,active')).body)
    .toEqual([{ remind_time: '18:30:00', channels: ['inapp', 'email'], active: true }])

  // editing shows it again; switching it off removes it
  await page.getByRole('button', { name: 'Vitamin D – edit' }).click()
  await expect(dialog.getByRole('button', { name: 'Daily reminder' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByLabel('Time')).toHaveValue('18:30')
  await dialog.getByRole('button', { name: 'Daily reminder' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect.poll(async () => (await restAs(user, 'habit_reminders?select=id')).body).toEqual([])
})

test('TS-R2/R3/R6 the server reminds once a day – not when the habit is done', async () => {
  test.setTimeout(180_000)
  const now = new Date()
  // the reminder time is the next minute; too close to midnight UTC the "day" would change during the test
  test.skip(now.getUTCHours() === 23 && now.getUTCMinutes() >= 55, 'too close to midnight UTC')
  const user = await createUser('habit-server')
  await restAs(user, 'user_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ time_zone: 'UTC', quiet_start: null, quiet_end: null }),
  })
  const soon = new Date(now.getTime() + 60_000)
  const remindTime = `${pad(soon.getUTCHours())}:${pad(soon.getUTCMinutes())}`
  const today = soon.toISOString().slice(0, 10)

  const [open] = (await restAs(user, 'habits', { method: 'POST', body: JSON.stringify({ name: 'Walk Bello', emoji: '🐕' }) })).body
  const [done] = (await restAs(user, 'habits', { method: 'POST', body: JSON.stringify({ name: 'Gym', emoji: '🏃' }) })).body
  await restAs(user, 'habit_completions', { method: 'POST', body: JSON.stringify({ habit_id: done.id, day: today }) })
  for (const habit of [open, done]) {
    const response = await restAs(user, 'habit_reminders', {
      method: 'POST',
      body: JSON.stringify({ habit_id: habit.id, remind_time: remindTime, channels: ['push'] }),
    })
    expect(response.status).toBe(201)
  }

  const reminderOf = async (habitId) => (await restAs(user, `habit_reminders?select=last_sent_on,attempts&habit_id=eq.${habitId}`)).body[0]
  // the open habit: handled once today (push skipped – no device), logged with the habit
  await expect.poll(() => reminderOf(open.id), { timeout: 150_000, intervals: [3000] }).toMatchObject({ last_sent_on: today, attempts: 0 })
  const log = (await restAs(user, `notification_log?select=channel,result,detail&habit_id=eq.${open.id}`)).body
  expect(log).toEqual([{ channel: 'push', result: 'skipped', detail: 'no device with push switched on' }])

  // the habit done today: never sent
  expect(await reminderOf(done.id)).toMatchObject({ last_sent_on: null })
  expect((await restAs(user, `notification_log?select=id&habit_id=eq.${done.id}`)).body).toEqual([])
})

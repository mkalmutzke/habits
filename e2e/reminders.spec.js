import { expect, test } from '@playwright/test'
import { createECDH, randomBytes } from 'node:crypto'
import { createUser, openSignedIn, restAs } from './helpers.js'

// Test plan TS-N (reminders, notification settings) and TS-O3 (offline start).
// The scheduler in the local stack calls send-reminders every minute.
const shot = (page, name) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true })

// Keys of a made-up device, new for every run (no fixed key-like strings in the repo).
function fakeDeviceKeys() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }
}

async function taskWithReminder(user, title, remindAt, channels) {
  const [task] = (await restAs(user, 'todo_tasks', { method: 'POST', body: JSON.stringify({ title }) })).body
  const response = await restAs(user, 'todo_reminders', {
    method: 'POST',
    body: JSON.stringify({ task_id: task.id, remind_at: remindAt.toISOString(), channels }),
  })
  expect(response.status).toBe(201)
  return { task, reminder: response.body[0] }
}

test('TS-N1 notification settings are saved and apply everywhere', async ({ page }) => {
  const user = await createUser('settings')
  await openSignedIn(page, user, '/#/settings')
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()

  await page.getByRole('button', { name: 'In-app pop-ups' }).click()
  await page.getByRole('button', { name: 'Email', exact: true }).click()
  await page.getByRole('button', { name: 'Quiet hours' }).click()
  // v3: no default time in Settings any more (owner, mockup review)
  await expect(page.getByLabel('Default reminder time')).toHaveCount(0)
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('22:00')
  await shot(page, 'settings')

  await expect
    .poll(async () => {
      const [row] = (await restAs(user, 'user_settings?select=inapp_on,email_on,default_remind_time,quiet_start,quiet_end')).body
      return row
    })
    .toEqual({ inapp_on: false, email_on: true, default_remind_time: '09:00:00', quiet_start: '22:00:00', quiet_end: '07:00:00' })
})

test('TS-N2 a reminder on a task: default time, channels, shown in the list', async ({ page }) => {
  const user = await createUser('remind')
  await openSignedIn(page, user, '/#/list/all')
  await page.getByLabel('Add a task to All').fill('Call the dentist')
  await page.getByLabel('Add a task to All').press('Enter')
  await page.getByRole('link', { name: /Call the dentist/ }).click()

  await page.getByRole('button', { name: 'Remind me' }).click()
  await expect(page.getByRole('group', { name: 'Remind me by' })).toBeVisible()
  // in-app is on by default; push isn't switched on on this device
  await expect(page.getByRole('button', { name: 'In app' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Email', exact: true }).click()
  await page.locator('#remind-at').fill('2030-01-15T14:00')
  await shot(page, 'task-reminder')

  await expect
    .poll(async () => (await restAs(user, 'todo_reminders?select=remind_at,channels,status')).body)
    .toEqual([{ remind_at: '2030-01-15T13:00:00+00:00', channels: ['inapp', 'email'], status: 'pending' }])

  // a task without a list goes back to What's up?, which lists every task
  await page.getByRole('link', { name: 'What’s up?' }).click()
  await expect(page.getByText('⏰ Tue 15 Jan 14:00')).toBeVisible()
})

test('TS-N3 an in-app reminder pops up while the app is open and opens the task', async ({ page }) => {
  const user = await createUser('popup')
  const { task } = await taskWithReminder(user, 'Water the plants', new Date(Date.now() - 30_000), ['inapp'])
  await openSignedIn(page, user)
  const banner = page.getByText('⏰ Water the plants')
  await expect(banner).toBeVisible()
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`#/task/${task.id}$`))
  // shown once per device: not again after a reload
  await page.reload()
  await page.waitForTimeout(1500)
  await expect(page.getByText('⏰ Water the plants')).toHaveCount(0)
})

test('TS-N4 the server sends due reminders: done, retried, postponed for quiet hours', async () => {
  test.setTimeout(150_000)
  const user = await createUser('server')
  // a device whose push service can't be reached → push fails → retry later
  await restAs(user, 'push_subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: 'https://127.0.0.1:9/push/unreachable',
      ...fakeDeviceKeys(),
    }),
  })
  const due = new Date(Date.now() - 60_000)
  const inapp = await taskWithReminder(user, 'Only in the app', due, ['inapp'])
  const push = await taskWithReminder(user, 'Push to a broken device', due, ['push'])

  const statusOf = async (id) => (await restAs(user, `todo_reminders?select=status,attempts,last_error&id=eq.${id}`)).body[0]
  await expect.poll(() => statusOf(inapp.reminder.id), { timeout: 120_000, intervals: [3000] }).toMatchObject({ status: 'sent' })
  await expect.poll(() => statusOf(push.reminder.id), { timeout: 30_000, intervals: [2000] }).toMatchObject({
    status: 'pending',
    attempts: 1,
    last_error: 'retry',
  })
  const log = (await restAs(user, 'notification_log?select=channel,result&order=created_at')).body
  expect(log).toContainEqual({ channel: 'push', result: 'failed' })

  // quiet hours right now → the next reminder waits until they end
  await restAs(user, 'user_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ time_zone: 'UTC', quiet_start: '00:00:00', quiet_end: '23:59:00' }),
  })
  const quiet = await taskWithReminder(user, 'Not at night', new Date(Date.now() - 30_000), ['push'])
  await expect
    .poll(async () => (await restAs(user, `todo_reminders?select=status,remind_at&id=eq.${quiet.reminder.id}`)).body[0], {
      timeout: 120_000,
      intervals: [3000],
    })
    .toMatchObject({ status: 'pending', remind_at: expect.stringMatching(/T23:59:00/) })
})

test('TS-N5 test button: no device yet, and only one test per minute', async ({ page }) => {
  const user = await createUser('testbtn')
  await openSignedIn(page, user, '/#/settings')
  await page.getByRole('button', { name: 'Send a test notification' }).click()
  await expect(page.getByText('Test: no device with push switched on.')).toBeVisible()
  await page.getByRole('button', { name: 'Send a test notification' }).click()
  await expect(page.getByText('Please wait a minute before the next test.')).toBeVisible()
})

test('TS-N6 push can’t be switched on without a push service: clear message, switch stays off', async ({ page, context }) => {
  // headless Chromium has no push service (real push is checked on the Android phone)
  await context.grantPermissions(['notifications'])
  const user = await createUser('nopush')
  await openSignedIn(page, user, '/#/settings')
  await page.evaluate(() => navigator.serviceWorker.ready)
  const toggle = page.getByRole('button', { name: 'Push on this device' })
  await toggle.click()
  await expect(page.locator('.toast.tone-error')).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

test('TS-O3 the installed app starts offline and shows the saved data', async ({ page, context }) => {
  const user = await createUser('offlinestart')
  await openSignedIn(page, user, '/#/list/all')
  await page.getByLabel('Add a task to All').fill('Read offline')
  await page.getByLabel('Add a task to All').press('Enter')
  await expect(page.getByRole('link', { name: /Read offline/ })).toBeVisible()
  // the service worker has stored the app files; the data copy is saved
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Offline – you can look at everything')).toBeVisible()
  await expect(page.getByRole('link', { name: /Read offline/ })).toBeVisible()
  await context.setOffline(false)
})

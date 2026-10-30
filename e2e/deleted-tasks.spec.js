import { expect, test } from '@playwright/test'
import { createUser, openSignedIn, restAs } from './helpers.js'

// Test plan v3 TS-S1, S2, S5: deleted tasks are kept 10 days, can be restored
// or deleted for good, and the Settings switch shows or hides them.

async function taskInAll(page, title) {
  await page.getByLabel('Add a task to All').fill(title)
  await page.getByLabel('Add a task to All').press('Enter')
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
}

test('TS-S1/S5 delete keeps the task greyed out under Deleted; Restore and Delete now', async ({ page }) => {
  const user = await createUser('deleted')
  await openSignedIn(page, user, '/#/list/all')
  await taskInAll(page, 'Cancel gym trial')
  await taskInAll(page, 'Old receipt')

  // delete both (no question – they can be restored)
  for (const title of ['Cancel gym trial', 'Old receipt']) {
    await page.goto('/#/list/all')
    await page.getByRole('link', { name: new RegExp(title) }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'What’s up?' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Cancel gym trial/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Deleted · 2' }).click()
  await expect(page.getByText('deleted · gone for good in 10 days').first()).toBeVisible()
  await expect.poll(async () => (await restAs(user, 'todo_tasks?select=deleted_at')).body.every((t) => t.deleted_at !== null)).toBe(true)

  // restore one
  await page.locator('.deleted-row').filter({ hasText: 'Cancel gym trial' }).getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('link', { name: /^Cancel gym trial/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deleted · 1' })).toBeVisible()

  // the other: open it, delete for good
  await page.getByRole('link', { name: /Old receipt/ }).click()
  await expect(page.getByText(/Deleted – gone for good in 10 days/)).toBeVisible()
  await page.getByRole('button', { name: 'Delete now' }).click()
  await page.getByRole('button', { name: 'Delete for good' }).click()
  await expect.poll(async () => (await restAs(user, 'todo_tasks?select=title')).body).toEqual([{ title: 'Cancel gym trial' }])
})

test('TS-S2 the Settings switch hides deleted tasks everywhere (default on)', async ({ page }) => {
  const user = await createUser('deleted-off')
  await openSignedIn(page, user, '/#/list/all')
  await taskInAll(page, 'Throw away')
  await page.getByRole('link', { name: /Throw away/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Deleted · 1' })).toBeVisible()

  await page.getByRole('link', { name: 'Settings' }).click()
  const toggle = page.getByRole('button', { name: 'Show deleted tasks' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => (await restAs(user, 'user_settings?select=show_deleted_tasks')).body).toEqual([{ show_deleted_tasks: false }])

  await page.goto('/#/today')
  await expect(page.getByRole('heading', { name: /^ToDo’s/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Deleted/ })).toHaveCount(0)
  await page.goto('/#/list/all')
  await expect(page.getByRole('button', { name: /Deleted/ })).toHaveCount(0)
})

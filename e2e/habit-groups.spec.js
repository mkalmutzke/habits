import { expect, test } from '@playwright/test'
import { createUser, openSettingsSection, openSignedIn, restAs } from './helpers.js'

// v3.6: habit groups – managed in Settings, chosen in the habit dialog,
// shown on What's up? as foldable bars (folded at app start), with an icon to
// switch to one list of all habits.

const todayButton = (page, name) => page.getByRole('button', { name: new RegExp(`^${name}, \\w+ \\d+ \\w+: (done|not done)`) }).last()

test('v3.6 groups: add in Settings, pick in the dialog, folded bars and the all-habits icon', async ({ page }) => {
  const user = await createUser('groups')
  // a habit from before groups existed: it lands in the default group
  await restAs(user, 'habits', { method: 'POST', body: JSON.stringify({ name: 'Read', emoji: '📚', position: 1 }) })

  // Settings → Habit groups: add "Sport", rename the default group to "Misc"
  await openSignedIn(page, user, '/#/settings')
  await openSettingsSection(page, 'Habit groups')
  await page.getByLabel('New group name').fill('Sport')
  await page.getByRole('button', { name: 'Add group' }).click()
  await expect(page.getByLabel('Name of group Sport')).toHaveValue('Sport')
  const defaultName = page.getByLabel('Name of the default group')
  await defaultName.fill('Misc')
  await defaultName.press('Enter')
  await expect.poll(async () => (await restAs(user, 'user_settings?select=default_habit_group')).body).toEqual([{ default_habit_group: 'Misc' }])

  // a new habit in "Sport"
  await page.goto('/#/today')
  await page.getByRole('button', { name: /^Habits/ }).click()
  await page.getByRole('button', { name: 'Add a habit' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Habit name').fill('Run')
  await dialog.getByLabel('Group').selectOption({ label: 'Sport' })
  await dialog.getByRole('button', { name: 'Save' }).click()

  // two folded group bars, in order: Sport, then the default group
  const sport = page.locator('.habit-group-toggle', { hasText: 'Sport' })
  const misc = page.locator('.habit-group-toggle', { hasText: 'Misc' })
  await expect(sport).toHaveAttribute('aria-expanded', 'false')
  await expect(misc).toHaveAttribute('aria-expanded', 'false')
  await expect(sport).toContainText('0 of 1')
  await expect(todayButton(page, 'Run')).toHaveCount(0)
  await sport.click()
  await todayButton(page, 'Run').click()
  await expect(sport).toContainText('1 of 1')

  // the icon shows all habits in one list, and back
  const toggle = page.getByRole('button', { name: 'Show in groups' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(todayButton(page, 'Read')).toBeVisible()
  await expect(page.locator('.habit-group-toggle')).toHaveCount(0)

  // a fresh start begins with the groups again (like the IBKR eye)
  await page.reload()
  await page.getByRole('button', { name: /^Habits/ }).click()
  await expect(page.getByRole('button', { name: 'Show in groups' })).toHaveAttribute('aria-pressed', 'true')

  // deleting the group moves its habit to the default group
  await page.goto('/#/settings')
  await openSettingsSection(page, 'Habit groups')
  await page.getByRole('button', { name: 'Delete group Sport' }).click()
  await expect.poll(async () => (await restAs(user, 'habits?select=name,group_id&order=name')).body).toEqual([
    { name: 'Read', group_id: null },
    { name: 'Run', group_id: null },
  ])
})

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSettingsSection, openSignedIn, restAs } from './helpers.js'

// v3.8 (owner): Settings → Modules – IBKR on/off, Garmin off / icon / section.
const settingsRow = async (user) => (await restAs(user, 'user_settings?select=ibkr_display,garmin_display')).body[0]

test('v3.8 modules: Garmin as a card on What’s up?, IBKR hidden, then Garmin off', async ({ page }) => {
  const user = await createUser('modules')
  await openSignedIn(page, user)
  // as before: the IBKR card and the Garmin icon
  await expect(page.locator('.card-section-title').first()).toHaveText('IBKR')
  await expect(page.getByRole('button', { name: 'Garmin' })).toBeVisible()

  await page.goto('/#/settings')
  await openSettingsSection(page, 'Modules')
  await page.getByRole('group', { name: 'Garmin' }).getByRole('button', { name: 'Section' }).click()
  await page.getByRole('button', { name: 'IBKR portfolio' }).click()
  await expect.poll(() => settingsRow(user)).toEqual({ ibkr_display: 'off', garmin_display: 'section' })
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])

  // What's up?: Garmin is the first card, no IBKR card, no Garmin icon
  await page.goto('/#/today')
  await expect(page.locator('.card-section-title')).toHaveText(['Garmin', 'Habits', 'Shopping', 'ToDo’s'])
  await expect(page.getByRole('button', { name: 'Garmin', exact: true })).toHaveCount(0)
  const card = page.getByRole('button', { name: /^Garmin/ })
  await expect(card).toHaveAttribute('aria-expanded', 'false')
  await card.click()
  await expect(page.getByText(/No data from Garmin yet/)).toBeVisible()
  // with the IBKR card hidden, the IBKR brief's icon is in the header
  await expect(page.getByRole('button', { name: /^Morning brief/ })).toBeVisible()

  // Garmin off: gone everywhere
  // (the section is still open: Settings remembers it for this visit)
  await page.goto('/#/settings')
  await page.getByRole('group', { name: 'Garmin' }).getByRole('button', { name: 'Off' }).click()
  await expect.poll(async () => (await settingsRow(user)).garmin_display).toBe('off')
  await page.goto('/#/today')
  await expect(page.locator('.card-section-title')).toHaveText(['Habits', 'Shopping', 'ToDo’s'])
  await expect(page.getByRole('button', { name: /Garmin/ })).toHaveCount(0)
})

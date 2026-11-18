import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSettingsSection, openSignedIn, restAs } from './helpers.js'

// v3.6: the daily briefs – icons, windows and the Settings switches. The
// briefs themselves are written by the server (brief-ingest, checked in the
// database tests and by hand); a new account has none yet.

test('v3.6 briefs: icons open their windows; a switch in Settings hides the icon', async ({ page }) => {
  const user = await createUser('briefs')
  await openSignedIn(page, user)

  // the morning brief's newspaper sits on the IBKR card; jobs and world in the header
  const ibkr = page.locator('.portfolio-section').getByRole('button', { name: 'Morning brief' })
  await expect(ibkr).toBeVisible()
  await expect(page.getByRole('button', { name: 'Canada jobs brief' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'World news' })).toBeVisible()

  await page.getByRole('button', { name: 'World news' }).click()
  const window = page.getByRole('dialog', { name: 'World news' })
  await expect(window.getByText(/No brief yet/)).toBeVisible()
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations).toEqual([])
  await window.getByRole('button', { name: 'Close' }).click()

  await ibkr.click()
  await expect(page.getByRole('dialog', { name: 'Morning brief' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Morning brief' }).getByRole('button', { name: 'Close' }).click()

  // Settings → Daily briefs: switch the Canada jobs brief off
  await page.goto('/#/settings')
  await openSettingsSection(page, 'Daily briefs')
  const toggle = page.getByRole('button', { name: 'Canada jobs brief – run every morning' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => (await restAs(user, 'user_settings?select=brief_jobs_on')).body).toEqual([{ brief_jobs_on: false }])

  // its icon is gone from every main page; the others stay
  await page.goto('/#/today')
  await expect(page.getByRole('button', { name: 'World news' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Canada jobs brief' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Dawn' }).click()
  await expect(page.getByRole('button', { name: 'Canada jobs brief' })).toHaveCount(0)

  // the app can't write a brief itself (only brief-ingest can)
  const forged = await restAs(user, 'briefs', { method: 'POST', body: JSON.stringify({ kind: 'world', for_day: '2026-11-01', content: {} }) })
  expect(forged.status).toBeGreaterThanOrEqual(400)
})

test('v3.9 brief settings: countries, topics, icon and name are saved; the icon hides while the brief runs', async ({ page }) => {
  const user = await createUser('brief-prefs')
  await openSignedIn(page, user, '/#/settings')
  await openSettingsSection(page, 'Daily briefs')
  await page.getByRole('button', { name: /^Canada jobs brief/, expanded: false }).click()

  // a second country: the brief becomes the "Job market brief"
  await page.getByRole('textbox', { name: 'Countries' }).fill('Switzerland')
  await page.getByRole('textbox', { name: 'Countries' }).press('Enter')
  await expect(page.getByRole('list', { name: 'Countries' }).getByRole('listitem')).toHaveText(['Canada✕', 'Switzerland✕'])
  await expect(page.getByRole('button', { name: /^Job market brief/, expanded: true })).toBeVisible()
  // a topic off, fewer items, a note
  await page.getByRole('button', { name: 'Remote work' }).click()
  await page.getByLabel('Items at most').selectOption('5')
  await page.getByLabel('Also follow').fill('SAP news in German-speaking countries')
  await page.getByLabel('Also follow').blur()
  await expect
    .poll(async () => (await restAs(user, 'user_settings?select=brief_prefs')).body[0]?.brief_prefs?.jobs)
    .toMatchObject({ countries: ['Canada', 'Switzerland'], max: 5, extra: 'SAP news in German-speaking countries' })
  expect((await restAs(user, 'user_settings?select=brief_prefs')).body[0].brief_prefs.jobs.topics).not.toContain('remote')
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])

  // icon off: hidden on What's up?, while the brief still runs
  await page.getByRole('button', { name: 'Show its icon' }).click()
  await expect.poll(async () => (await restAs(user, 'user_settings?select=brief_prefs')).body[0]?.brief_prefs?.jobs?.icon).toBe(false)
  await expect(page.getByRole('button', { name: 'Job market brief – run every morning' })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/#/today')
  await expect(page.getByRole('button', { name: /Job market brief/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'World news' })).toBeVisible()
})

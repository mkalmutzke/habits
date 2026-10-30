import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSignedIn } from './helpers.js'

// Test plan TS-Q: automatic accessibility check (WCAG 2.1 A and AA rules) per page.
const PAGES = [
  ['sign-in', null, '/'],
  ['today', 'What’s up?', '/#/today'],
  ['week', 'Week', '/#/week'],
  ['lists', 'Lists', '/#/lists'],
  ['all-tasks', 'All', '/#/list/all'],
  ['settings', 'Settings', '/#/settings'],
]

for (const [name, heading, path] of PAGES) {
  test(`TS-Q1 no accessibility violations: ${name}`, async ({ page }) => {
    if (heading) {
      await openSignedIn(page, await createUser(`a11y-${name}`), path)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    } else {
      await page.goto(path)
      await expect(page.getByRole('button', { name: 'Send code' })).toBeVisible()
    }
    // wait for entry animations to finish, so colours are measured at rest
    await page.waitForTimeout(800)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])
  })
}

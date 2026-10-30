import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSignedIn } from './helpers.js'

// Test plan v3 TS-W: the shell – "What's up?", the gear, and a header that
// never moves when switching tabs (design v3 §2.1).

// Where the header ends and the page starts, in screen pixels.
async function layout(page) {
  const header = await page.locator('.app-header').boundingBox()
  const panel = await page.locator('#view-panel').boundingBox()
  return { headerTop: header.y, headerHeight: header.height, panelTop: panel.y }
}

test('TS-W1/W2/W3 start page is “What’s up?” with a gear and no message of the day', async ({ page }) => {
  await openSignedIn(page, await createUser('shell'))
  await expect(page.getByRole('heading', { level: 1, name: 'What’s up?' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'What’s up?' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: /how this app is built/i })).toHaveCount(0)
  await expect(page.locator('.daily-message')).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  // the architecture overview now lives in Settings, as a page (TS-S6, S7)
  await expect(page.getByText('Version 3.5.0')).toBeVisible()
  await page.getByRole('link', { name: /How it’s built/ }).click()
  await expect(page).toHaveURL(/#\/settings\/about$/)
  await expect(page.getByRole('heading', { level: 1, name: 'How it’s built' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Topic' }).selectOption('database')
  await expect(page.locator('.db-name', { hasText: 'habit_reminders' })).toBeVisible()
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('link', { name: 'What’s up?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'What’s up?' })).toBeVisible()
  // old address still works
  await page.goto('/#/today')
  await expect(page.getByRole('heading', { level: 1, name: 'What’s up?' })).toBeVisible()
})

test('TS-W4 switching tabs moves nothing: same header height, page starts at the same place', async ({ page }) => {
  await openSignedIn(page, await createUser('shell-jump'))
  await expect(page.getByRole('heading', { level: 1, name: 'What’s up?' })).toBeVisible()
  const first = await layout(page)

  for (const [tab, title] of [['Week', 'Week'], ['Lists', 'Lists'], ['What’s up?', 'What’s up?']]) {
    // record every position the header and page take while switching
    await page.evaluate(() => {
      window.__tops = []
      const record = () => {
        const header = document.querySelector('.app-header')?.getBoundingClientRect()
        const panel = document.querySelector('#view-panel')?.getBoundingClientRect()
        if (header && panel) window.__tops.push([header.top, header.height, panel.top])
        if (window.__tops.length < 40) requestAnimationFrame(record)
      }
      requestAnimationFrame(record)
    })
    await page.getByRole('tab', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await page.waitForFunction(() => window.__tops.length >= 40)
    const tops = await page.evaluate(() => window.__tops)
    for (const [headerTop, headerHeight, panelTop] of tops) {
      expect(headerTop).toBeCloseTo(first.headerTop, 0)
      expect(headerHeight).toBeCloseTo(first.headerHeight, 0)
      expect(panelTop).toBeCloseTo(first.panelTop, 0)
    }
  }
})

test('TS-W6 the header stays on top while the page scrolls', async ({ page }) => {
  await openSignedIn(page, await createUser('shell-sticky'), '/#/lists')
  await expect(page.getByRole('heading', { level: 1, name: 'Lists' })).toBeVisible()
  // make the page taller than the screen, then scroll down
  await page.evaluate(() => {
    document.querySelector('#view-panel').style.paddingBottom = '3000px'
    window.scrollTo(0, 1500)
  })
  const header = await page.locator('.app-header').boundingBox()
  expect(header.y).toBeCloseTo(0, 0)
  await expect(page.getByRole('heading', { level: 1, name: 'Lists' })).toBeInViewport()
})

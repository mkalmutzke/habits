import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSignedIn, restAs } from './helpers.js'

// Test plan v3 TS-K: the Week page – the shopping list; v3.5 TS-G: the Garmin
// card in place of the habit grid (habits stay on What's up?).

const shot = (page, name) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true })

const items = async (user) => (await restAs(user, 'shopping_items?select=title,ticked_at&order=position')).body

// v3.1: every item needs its own tap on ＋ – the field closes after adding
async function addItems(page, ...titles) {
  for (const title of titles) {
    await page.getByRole('button', { name: 'Add an item' }).click()
    await page.getByLabel('New item').fill(title)
    await page.getByLabel('New item').press('Enter')
    await expect(page.getByRole('button', { name: title })).toBeVisible()
  }
}

test('TS-G1 v3.5: the Week page has the Garmin card instead of Habits – folded, not set up yet, readable', async ({ page }) => {
  const user = await createUser('week')
  await openSignedIn(page, user)
  await page.getByRole('tab', { name: 'Week' }).click()
  await expect(page.getByText(/^Last 7 days · /)).toBeVisible()
  // Habits stay on What's up? only (owner, v3.5)
  await expect(page.getByRole('button', { name: /^Habits/ })).toHaveCount(0)
  // folded at every app start (G2); a new account has no Garmin data – the card's
  // figures are covered by the component tests (GarminSection.test.jsx)
  const garmin = page.getByRole('button', { name: /^Garmin/ })
  await expect(garmin).toHaveAttribute('aria-expanded', 'false')
  await expect(garmin).toContainText('not set up yet')
  await garmin.click()
  await expect(page.getByText(/No data from Garmin yet/)).toBeVisible()
  await shot(page, 'week-garmin')
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations).toEqual([])
})

test('TS-K2/K3/K4 shopping: add several, tick moves to the bottom, clear ticked with undo', async ({ page }) => {
  const user = await createUser('shop')
  await openSignedIn(page, user, '/#/week')
  await expect(page.getByText('Nothing to buy')).toBeVisible()
  // each item needs ＋; the field closes after adding (TS-K2, v3.1)
  await addItems(page, 'Oat milk', 'Dog food', 'Tomatoes')
  await expect(page.getByLabel('New item')).toHaveCount(0)

  // tick "Oat milk": struck through and moved to the bottom (D8)
  await page.getByRole('button', { name: 'Oat milk' }).click()
  await expect(page.getByRole('button', { name: 'Oat milk' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.shopping-title')).toHaveText(['Dog food', 'Tomatoes', 'Oat milk'])
  await shot(page, 'week-shopping')
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])

  // tap again: back in its place
  await page.getByRole('button', { name: 'Oat milk' }).click()
  await expect(page.locator('.shopping-title')).toHaveText(['Oat milk', 'Dog food', 'Tomatoes'])

  // clear ticked, then undo
  await page.getByRole('button', { name: 'Tomatoes' }).click()
  await page.getByRole('button', { name: 'Clear ticked' }).click()
  await expect(page.getByRole('button', { name: 'Tomatoes' })).toHaveCount(0)
  await expect.poll(async () => (await items(user)).map((item) => item.title)).toEqual(['Oat milk', 'Dog food'])
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: 'Tomatoes' })).toBeVisible()
  await expect.poll(async () => (await items(user)).length).toBe(3)
})

test('TS-K8 long-press (or F2) renames an item', async ({ page }) => {
  const user = await createUser('rename')
  await openSignedIn(page, user, '/#/week')
  await addItems(page, 'Coffe')

  // hold for longer than half a second: rename instead of tick
  await page.getByRole('button', { name: 'Coffe' }).hover()
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()
  await expect(page.getByLabel('Rename Coffe')).toBeFocused()
  await page.getByLabel('Rename Coffe').fill('Coffee beans')
  await page.getByLabel('Rename Coffe').press('Enter')
  await expect(page.getByRole('button', { name: 'Coffee beans' })).toHaveAttribute('aria-pressed', 'false')

  // keyboard: F2; Esc keeps the old name
  await page.getByRole('button', { name: 'Coffee beans' }).focus()
  await page.keyboard.press('F2')
  await page.getByLabel('Rename Coffee beans').fill('Something else')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Coffee beans' })).toBeVisible()
  await expect.poll(async () => (await items(user)).map((item) => item.title)).toEqual(['Coffee beans'])
})

test('TS-K7 an item added on one device appears on the other', async ({ browser }) => {
  const user = await createUser('shop-live')
  const phone = await (await browser.newContext()).newPage()
  const laptop = await (await browser.newContext()).newPage()
  await openSignedIn(phone, user, '/#/week')
  await openSignedIn(laptop, user, '/#/week')
  await expect(laptop.getByText('Nothing to buy')).toBeVisible()
  await addItems(phone, 'Batteries')
  await expect(laptop.getByRole('button', { name: 'Batteries' })).toBeVisible({ timeout: 10_000 })
})

// v3.3 (test plan TS-D, TS-F11): the Week page's three cards (v3.5: Garmin first)
// A date key `offset` days from today, in the tests' time zone.
const dayKey = (offset) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' })

test('TS-D5/D7/D8/F11/A10 v3.3/v3.5: Garmin, Due & overdue and Shopping; due tasks of every list', async ({ page }) => {
  const user = await createUser('due')
  const [work] = (await restAs(user, 'todo_lists', { method: 'POST', body: JSON.stringify({ name: 'Work', color: 'blue', show_in_all: false }) })).body
  const task = (title, due_date, list_id = null) => restAs(user, 'todo_tasks', { method: 'POST', body: JSON.stringify({ title, due_date, list_id }) })
  await task('Old bill', dayKey(-2))
  await task('Quarterly report', dayKey(1), work.id)
  await task('Far away', dayKey(10))

  await openSignedIn(page, user, '/#/week')
  await expect(page.locator('.card-section-title')).toHaveText(['Garmin', 'Due & overdue', 'Shopping'])
  // start states (owner Q5, v3.5 G2): Garmin and Due & overdue folded, Shopping open
  const due = page.getByRole('button', { name: /^Due & overdue/ })
  await expect(due).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: /^Shopping/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(due).toContainText('1 overdue · 1 this week')

  await due.click()
  await expect(page.getByRole('heading', { name: 'Overdue', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Tomorrow · / })).toBeVisible()
  // a list that is "not in All" still shows here (Q3, TS-A10)
  await expect(page.getByRole('link', { name: /Quarterly report/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Far away/ })).toHaveCount(0)
  await shot(page, 'week-due')

  // tick: completed, it leaves the card (TS-D7)
  await page.getByRole('button', { name: 'Mark done: Old bill' }).click()
  await expect(page.getByRole('link', { name: /Old bill/ })).toHaveCount(0)
  await expect(due).toContainText('1 this week')
  await expect(due).not.toContainText('overdue ·')

  // open a task and come back: the card is still open
  await page.getByRole('link', { name: /Quarterly report/ }).click()
  await expect(page).toHaveURL(/#\/task\//)
  await page.goBack()
  await expect(due).toHaveAttribute('aria-expanded', 'true')

  // a task due today added elsewhere appears live (TS-D8)
  await task('Pay electricity bill', dayKey(0))
  await expect(page.getByRole('link', { name: /Pay electricity bill/ })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /^Today · / })).toBeVisible()
})

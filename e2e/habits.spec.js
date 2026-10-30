import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSignedIn, restAs } from './helpers.js'

// Test plan v3 TS-H (habit week grid on What's up?), v2 TS-H/TS-O (cloud,
// offline) and TS-S5 (isolation).

// The day buttons of a habit's row (4 since v3.1), oldest first – the last one is today.
const dayButtons = (page, name) => page.getByRole('button', { name: new RegExp(`^${name}, \\w+ \\d+ \\w+: (done|not done)`) })
const todayButton = (page, name) => dayButtons(page, name).last()

// The section starts folded every time the app opens (owner, mockup review).
async function showHabits(page) {
  const show = page.getByRole('button', { name: /^Habits/, expanded: false })
  if (await show.isVisible()) await show.click()
}

async function addHabit(page, name) {
  // the welcome card's button, or the small ＋ once there are habits
  const add = page.getByRole('button', { name: /^(Add your first habit|Add a habit)$/ }).first()
  await expect(add).toBeVisible()
  await add.click()
  await page.getByRole('dialog').getByLabel('Habit name').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(todayButton(page, name)).toBeVisible()
}

test('TS-H1/H2 the grid shows 4 days (v3.1); ticking today and a past day is saved', async ({ page }) => {
  const user = await createUser('habit')
  await openSignedIn(page, user)
  await addHabit(page, 'Drink water')
  await expect(dayButtons(page, 'Drink water')).toHaveCount(4)

  await todayButton(page, 'Drink water').click()
  await expect(todayButton(page, 'Drink water')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('1 of 1 today')).toBeVisible()
  await dayButtons(page, 'Drink water').first().click()
  await expect(dayButtons(page, 'Drink water').first()).toHaveAttribute('aria-pressed', 'true')

  // straight from the database, like another device would read it
  await expect.poll(async () => (await restAs(user, 'habit_completions?select=day')).body.length).toBe(2)
  const habits = await restAs(user, 'habits?select=name,emoji')
  expect(habits.body).toEqual([{ name: 'Drink water', emoji: '🐕' }])

  // the open grid passes the accessibility rules (TS-Q1)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `test-results/screens/${test.info().project.name}-habit-grid.png` })
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])

  // untick the past day again
  await dayButtons(page, 'Drink water').first().click()
  await expect.poll(async () => (await restAs(user, 'habit_completions?select=day')).body.length).toBe(1)

  // fresh start: folded, and still ticked when opened
  await page.reload()
  await expect(page.getByRole('button', { name: /^Habits/, expanded: false })).toHaveAttribute('aria-expanded', 'false')
  await showHabits(page)
  await expect(todayButton(page, 'Drink water')).toHaveAttribute('aria-pressed', 'true')
})

test('TS-H5 starts folded; folded shows only the count, no icons', async ({ page }) => {
  const user = await createUser('fold')
  await openSignedIn(page, user)
  await addHabit(page, 'Gym')
  await page.getByRole('button', { name: /^Habits/, expanded: true }).click()
  await expect(dayButtons(page, 'Gym')).toHaveCount(0)
  await expect(page.getByText('0 of 1 today')).toBeVisible()
  await expect(page.locator('.habit-section').getByText('🐕')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: /^Habits/, expanded: false })).toBeVisible()
})

test('TS-H7 the dialog offers the four icons; rename and delete a habit', async ({ page }) => {
  const user = await createUser('edit')
  await openSignedIn(page, user)
  await page.getByRole('button', { name: 'Add your first habit' }).click()
  const icons = page.getByRole('dialog').getByRole('group', { name: 'Icon' }).getByRole('button')
  await expect(icons).toHaveText(['🐕Dog', '🏃Sport', '💊Medication', '✨Other'])
  await icons.nth(2).click()
  await page.getByRole('dialog').getByLabel('Habit name').fill('Read')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(todayButton(page, 'Read')).toBeVisible()
  expect((await restAs(user, 'habits?select=emoji')).body).toEqual([{ emoji: '💊' }])

  await page.getByRole('button', { name: 'Read – edit' }).click()
  await page.getByRole('dialog').getByLabel('Habit name').fill('Read 10 pages')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(todayButton(page, 'Read 10 pages')).toBeVisible()

  await page.getByRole('button', { name: 'Read 10 pages – edit' }).click()
  await page.getByRole('button', { name: 'Delete habit' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add your first habit' })).toBeVisible()
  await expect.poll(async () => (await restAs(user, 'habits?select=id')).body.length).toBe(0)
})

test('TS-H8 a change on one device appears live on the other', async ({ browser }) => {
  const user = await createUser('live')
  const phone = await (await browser.newContext()).newPage()
  const laptop = await (await browser.newContext()).newPage()
  await openSignedIn(phone, user)
  await openSignedIn(laptop, user)
  await expect(laptop.getByRole('button', { name: 'Add your first habit' })).toBeVisible()

  await addHabit(phone, 'Meditate')
  // no reload on the laptop – the change arrives through Realtime
  await expect(laptop.getByRole('button', { name: /^Habits/, expanded: false })).toBeVisible({ timeout: 10_000 })
  await showHabits(laptop)
  await todayButton(laptop, 'Meditate').click()
  await expect(todayButton(phone, 'Meditate')).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 })
})

// (Starting the app while offline needs the service worker – TS-O3 in pwa.spec.js.)
test('TS-H9 offline: everything visible, changes switched off', async ({ page, context }) => {
  const user = await createUser('offline')
  await openSignedIn(page, user)
  await addHabit(page, 'Stretch')

  await context.setOffline(true)
  await expect(page.getByText('Offline – you can look at everything')).toBeVisible()
  await expect(todayButton(page, 'Stretch')).toBeVisible()
  await expect(todayButton(page, 'Stretch')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add a habit' })).toBeDisabled()

  await context.setOffline(false)
  await expect(page.getByText('Offline – you can look at everything')).toBeHidden()
  await expect(todayButton(page, 'Stretch')).toBeEnabled()
})

test('TS-S5 another user sees none of my habits, also not live', async ({ browser }) => {
  const me = await createUser('me')
  const other = await createUser('other')
  const myPage = await (await browser.newContext()).newPage()
  const otherPage = await (await browser.newContext()).newPage()
  await openSignedIn(myPage, me)
  await openSignedIn(otherPage, other)
  await addHabit(myPage, 'Secret habit')

  await otherPage.waitForTimeout(2000)
  await expect(otherPage.getByText('Secret habit')).toHaveCount(0)
  expect((await restAs(other, 'habits?select=id')).body).toEqual([])
})

// v3.3 (test plan TS-O): reorder habits by dragging the grip
const habitNames = (page) => page.locator('.wg-row:not(.wg-head) .wg-name')

async function dragGrip(page, fromName, toName) {
  const from = await page.getByRole('button', { name: `Move ${fromName}` }).boundingBox()
  const to = await page.getByRole('button', { name: `Move ${toName}` }).boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 12 })
  await page.mouse.up()
}

test('TS-O6/O7/O10 v3.3: drag a habit to the top – saved with one change, the same after reload', async ({ page }) => {
  const user = await createUser('order')
  await openSignedIn(page, user)
  for (const name of ['Walk', 'Read', 'Stretch']) await addHabit(page, name)
  await showHabits(page)
  await expect(habitNames(page)).toHaveText([/Walk/, /Read/, /Stretch/])
  const before = (await restAs(user, 'habits?select=name,position&order=position')).body

  await dragGrip(page, 'Stretch', 'Walk')
  await expect(habitNames(page)).toHaveText([/Stretch/, /Walk/, /Read/])
  await expect.poll(async () => (await restAs(user, 'habits?select=name&order=position')).body.map((row) => row.name)).toEqual(['Stretch', 'Walk', 'Read'])
  // only the moved habit got a new position (TS-O10)
  const after = (await restAs(user, 'habits?select=name,position&order=position')).body
  const changed = after.filter((row) => before.find((old) => old.name === row.name).position !== row.position)
  expect(changed.map((row) => row.name)).toEqual(['Stretch'])

  await page.reload()
  await showHabits(page)
  await expect(habitNames(page)).toHaveText([/Stretch/, /Walk/, /Read/])
  // v3.5: habits are no longer on the Week page (the Garmin card took their place)
})

test('TS-O8/O9 v3.3: the new order arrives live on the other device; dragging ticks nothing', async ({ browser }) => {
  const user = await createUser('order-live')
  const phone = await (await browser.newContext()).newPage()
  const laptop = await (await browser.newContext()).newPage()
  await openSignedIn(phone, user)
  for (const name of ['Walk', 'Read']) await addHabit(phone, name)
  await openSignedIn(laptop, user)
  await expect(laptop.getByRole('button', { name: /^Habits 0 of 2 today/, expanded: false })).toBeVisible()
  await showHabits(phone)
  await showHabits(laptop)

  await dragGrip(phone, 'Read', 'Walk')
  await expect(habitNames(laptop)).toHaveText([/Read/, /Walk/], { timeout: 10_000 })
  expect((await restAs(user, 'habit_completions?select=day')).body).toEqual([])
})

test('TS-O11 v3.3: with reduce motion, reordering still works', async ({ browser }) => {
  const user = await createUser('order-calm')
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage()
  await openSignedIn(page, user)
  for (const name of ['Walk', 'Read']) await addHabit(page, name)
  await showHabits(page)
  // drag Walk below Read: drop at the bottom edge of Read's row
  const last = await page.getByRole('button', { name: 'Move Read' }).boundingBox()
  const grip = await page.getByRole('button', { name: 'Move Walk' }).boundingBox()
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(last.x + last.width / 2, last.y + last.height, { steps: 12 })
  await page.mouse.up()
  await expect(habitNames(page)).toHaveText([/Read/, /Walk/])
})

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSignedIn, restAs } from './helpers.js'

// Test plan TS-U / v3 TS-T: What's up? (habits + ToDo's) and navigation.
const shot = (page, name) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true })

test('TS-U1 habits and ToDo’s on one page; ＋ opens a new task with the title focused (TS-T5)', async ({ page }) => {
  const user = await createUser('today')
  await openSignedIn(page, user)

  // habits: add two, tick one today (the last day button of its row)
  for (const name of ['Drink water', 'Read']) {
    await page.getByRole('button', { name: /^(Add your first habit|Add a habit)$/ }).first().click()
    await page.getByRole('dialog').getByLabel('Habit name').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  }
  await page.getByRole('button', { name: /^Read, .*: not done/ }).last().click()
  await expect(page.getByText('1 of 2 today')).toBeVisible()

  // ToDo's: no big add bar any more (TS-T8) – the small ＋ opens the details
  await expect(page.getByRole('heading', { name: /^ToDo’s/ })).toBeVisible()
  await expect(page.getByLabel(/Add a task to/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Add a task' }).click()
  await expect(page).toHaveURL(/#\/task\/new\?source=all$/)
  await expect(page.getByLabel('Task title')).toBeFocused()
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])
  await page.getByLabel('Task title').fill('Call the dentist')
  await page.getByLabel('Task title').press('Enter')
  await expect(page).toHaveURL(/#\/task\/[0-9a-f-]{36}$/)
  await expect(page.getByLabel('Add a step')).toBeVisible()
  await page.getByRole('link', { name: 'What’s up?' }).click()
  await expect(page.getByRole('link', { name: /Call the dentist/ })).toBeVisible()
  await expect(page.getByText('1 open')).toBeVisible()
  await shot(page, 'today-open')

  // fold the habits: the grid goes; after a reload the section starts folded
  await page.getByRole('button', { name: /^Habits/, expanded: true }).click()
  await expect(page.getByRole('button', { name: /^Read, / })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: /^Habits/, expanded: false })).toHaveAttribute('aria-expanded', 'false')
  await shot(page, 'today-folded')

  await expect.poll(async () => (await restAs(user, 'todo_tasks?select=title,list_id')).body).toEqual([{ title: 'Call the dentist', list_id: null }])
})

test('TS-T1/T3/T6 every task regardless of the day; the switcher filters; new tasks go to the chosen list', async ({ page }) => {
  const user = await createUser('switch')
  await openSignedIn(page, user, '/#/lists')
  await page.getByRole('button', { name: 'New list' }).click()
  await page.getByRole('dialog').getByLabel('List name').fill('Work')
  await page.getByRole('dialog').getByRole('button', { name: 'Create list' }).click()
  await page.getByLabel('Add a task to Work').fill('Send the invoice')
  await page.getByLabel('Add a task to Work').press('Enter')
  await page.getByRole('link', { name: /Send the invoice/ }).click()
  await page.getByLabel('Add due date').fill('2030-05-01') // a later day – still listed

  await page.goto('/#/today')
  // a task without a list
  await page.getByRole('button', { name: 'Add a task' }).click()
  await page.getByLabel('Task title').fill('Buy batteries')
  await page.getByLabel('Task title').press('Enter')
  await page.getByRole('link', { name: 'What’s up?' }).click()

  // All (the default) shows both
  await expect(page.getByRole('button', { name: 'Show tasks from: All' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Send the invoice/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Buy batteries\s*No list/ })).toBeVisible()

  // switch to Work
  await page.getByRole('button', { name: 'Show tasks from: All' }).click()
  await page.getByRole('button', { name: /^Work/ }).click()
  await expect(page.getByRole('link', { name: /Send the invoice/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Buy batteries/ })).toBeHidden()
  await shot(page, 'today-switcher')

  // ＋ while "Work" is selected → goes into Work
  await page.getByRole('button', { name: 'Add a task' }).click()
  await expect(page.getByText('Goes to Work')).toBeVisible()
  await page.getByLabel('Task title').fill('Plan the week')
  await page.getByLabel('Task title').press('Enter')
  await expect.poll(async () => {
    const tasks = (await restAs(user, 'todo_tasks?select=title,list_id')).body
    return tasks.find((t) => t.title === 'Plan the week')?.list_id ?? null
  }).not.toBeNull()

  // the choice is remembered on this device
  await page.goto('/#/today')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show tasks from: Work' })).toBeVisible()

  // ＋ and leaving with an empty title adds nothing (D7)
  await page.getByRole('button', { name: 'Add a task' }).click()
  await page.getByRole('link', { name: 'What’s up?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'What’s up?' })).toBeVisible()
  expect((await restAs(user, 'todo_tasks?select=id')).body).toHaveLength(3)
})

test('TS-U3 tabs and addresses: What’s up?, Week, Lists, a task, Settings', async ({ page }) => {
  const user = await createUser('nav')
  await openSignedIn(page, user)
  await page.getByRole('tab', { name: 'Week' }).click()
  await expect(page).toHaveURL(/#\/week$/)
  await expect(page.getByRole('heading', { name: 'Week' })).toBeVisible()
  await page.getByRole('tab', { name: 'Lists' }).click()
  await expect(page.getByRole('heading', { name: 'Lists' })).toBeVisible()
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  // an unknown address falls back to What’s up?
  await page.goto('/#/nonsense')
  await expect(page.getByRole('heading', { name: 'What’s up?' })).toBeVisible()
})

import { expect, test } from '@playwright/test'
import { createUser, openSignedIn, restAs } from './helpers.js'

// Test plan TS-T / v3 TS-L: the to-do list (lists, groups, tasks, steps,
// Important / Planned / All, search, repeat). Screenshots go to test-results/screens for a visual check.
const shot = (page, name) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true })

async function newList(page, name) {
  await page.goto('/#/lists')
  await page.getByRole('button', { name: 'New list' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('List name').fill(name)
  // v3 (TS-L2): no icons to choose any more
  await expect(dialog.getByRole('group', { name: 'Pick an emoji' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'green' }).click()
  await dialog.getByRole('button', { name: 'Create list' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

async function addTask(page, listName, title) {
  await page.getByLabel(`Add a task to ${listName}`).fill(title)
  await page.getByLabel(`Add a task to ${listName}`).press('Enter')
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
}

test('TS-T1/T2 lists in groups, tasks, important, completed section', async ({ page }) => {
  const user = await createUser('todo')
  await openSignedIn(page, user, '/#/lists')
  await expect(page.getByRole('heading', { name: 'Lists' })).toBeVisible()

  // a group with a list in it
  await page.getByRole('button', { name: 'New group' }).click()
  await page.getByRole('dialog').getByLabel('Group name').fill('Personal')
  await page.getByRole('dialog').getByRole('button', { name: 'Create group' }).click()
  await newList(page, 'Home')
  await page.getByRole('button', { name: 'Edit list Home' }).click()
  await page.getByRole('dialog').getByLabel('Group').selectOption({ label: 'Personal' })
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Personal · 0 open')).toBeVisible()

  await addTask(page, 'Home', 'Call the dentist')
  await addTask(page, 'Home', 'Repot the basil')
  await page.getByRole('button', { name: 'Mark important: Call the dentist' }).click()
  await page.getByRole('button', { name: 'Mark done: Repot the basil' }).click()
  await expect(page.getByRole('button', { name: 'Completed · 1' })).toBeVisible()
  await shot(page, 'list')

  // saved in the database
  await expect.poll(async () => (await restAs(user, 'todo_tasks?select=title,important,completed_at&order=title')).body.map((t) => [t.title, t.important, t.completed_at !== null]))
    .toEqual([['Call the dentist', true, false], ['Repot the basil', false, true]])

  // counts on the Lists page; the group sits in the top section (TS-L3)
  await page.goto('/#/lists')
  await expect(page.getByRole('link', { name: /Important\s*1/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Personal\s*1/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Home\s*1/ })).toBeVisible()
  await shot(page, 'lists')

  // the chevron hides and shows the group's lists, saved in the database (TS-L4)
  await page.getByRole('button', { name: 'Hide the lists of Personal' }).click()
  await expect(page.getByRole('link', { name: /Home\s*1/ })).toBeHidden()
  await expect.poll(async () => (await restAs(user, 'todo_groups?select=collapsed')).body).toEqual([{ collapsed: true }])
  await page.getByRole('button', { name: 'Show the lists of Personal' }).click()
  await expect(page.getByRole('link', { name: /Home\s*1/ })).toBeVisible()

  // the group's row shows all its tasks together
  await page.getByRole('link', { name: /Personal\s*1/ }).click()
  await expect(page.getByRole('heading', { name: 'Personal' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Call the dentist/ })).toBeVisible()
})

test('TS-T3/T4 task details: steps, due date, notes, move out of a list', async ({ page }) => {
  const user = await createUser('detail')
  await openSignedIn(page, user)
  await newList(page, 'Errands')
  await addTask(page, 'Errands', 'Buy batteries')
  await page.getByRole('link', { name: /Buy batteries/ }).click()

  await page.getByLabel('Add a step').fill('AA for the remote')
  await page.getByLabel('Add a step').press('Enter')
  await page.getByLabel('Add a step').fill('AAA for the scale')
  await page.getByLabel('Add a step').press('Enter')
  await page.getByRole('button', { name: 'AA for the remote', exact: true }).click()
  await expect(page.getByRole('button', { name: /My Day/ })).toHaveCount(0)
  await page.getByLabel('Add due date').fill('2026-12-24')
  await page.getByRole('textbox', { name: 'Notes' }).fill('The small ones')
  await page.getByLabel('Task title').click() // leaving the notes field saves them
  await shot(page, 'task')

  await expect.poll(async () => {
    const [task] = (await restAs(user, 'todo_tasks?select=due_date,notes')).body
    return [task.due_date, task.notes]
  }).toEqual(['2026-12-24', 'The small ones'])
  const steps = (await restAs(user, 'todo_steps?select=title,done&order=position')).body
  expect(steps).toEqual([{ title: 'AA for the remote', done: true }, { title: 'AAA for the scale', done: false }])

  // the list row shows the details
  await page.getByRole('link', { name: 'Errands' }).click()
  await expect(page.getByText('1 of 2')).toBeVisible()

  // move it out of the list: it shows under All with "No list"
  await page.getByRole('link', { name: /Buy batteries/ }).click()
  await page.getByRole('combobox').filter({ hasText: 'Errands' }).selectOption({ label: 'No list' })
  await page.goto('/#/list/all')
  await expect(page.getByRole('link', { name: /Buy batteries\s*No list/ })).toBeVisible()
})

test('TS-T5 Planned and search; old My Day / Tasks addresses show All (TS-L1)', async ({ page }) => {
  const user = await createUser('smart')
  await openSignedIn(page, user, '/#/list/my-day')
  await expect(page.getByRole('heading', { name: 'All' })).toBeVisible()
  await page.goto('/#/list/tasks')
  await expect(page.getByRole('heading', { name: 'All' })).toBeVisible()
  await page.goto('/#/lists')
  await expect(page.getByRole('link', { name: /My Day/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Tasks/ })).toHaveCount(0)
  await page.goto('/#/list/planned')
  await addTask(page, 'Planned', 'Pay the rent')
  await expect(page.getByText('Today', { exact: true })).toBeVisible()

  await page.goto('/#/lists')
  await page.getByLabel('Search tasks').fill('rent')
  await expect(page.getByText('1 found')).toBeVisible()
  await expect(page.getByRole('link', { name: /Pay the rent/ })).toBeVisible()
})

test('TS-T7 completing a repeating task creates the next one', async ({ page }) => {
  const user = await createUser('repeat')
  await openSignedIn(page, user, '/#/list/all')
  await addTask(page, 'All', 'Take out the bins')
  await page.getByRole('link', { name: /Take out the bins/ }).click()
  await page.getByLabel('Add due date').fill('2026-10-12')
  await page.getByLabel('Repeat', { exact: true }).selectOption('weekly')
  await expect(page.getByText('Repeat · Weekly')).toBeVisible()
  await page.getByRole('button', { name: 'Mark done' }).click()

  await expect.poll(async () => (await restAs(user, 'todo_tasks?select=due_date,completed_at&order=due_date')).body.map((t) => [t.due_date, t.completed_at !== null]))
    .toEqual([['2026-10-12', true], ['2026-10-19', false]])
  await page.goto('/#/list/all')
  await expect(page.getByText('↻ Weekly')).toBeVisible()
})

test('TS-T9 deleting a list deletes its tasks; offline nothing can be added', async ({ page, context }) => {
  const user = await createUser('delete')
  await openSignedIn(page, user)
  await newList(page, 'Temp')
  await addTask(page, 'Temp', 'Throwaway')
  await page.getByRole('button', { name: 'Edit list Temp' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete list' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Lists' })).toBeVisible()
  await expect.poll(async () => (await restAs(user, 'todo_tasks?select=id')).body.length).toBe(0)

  await page.goto('/#/list/all')
  await context.setOffline(true)
  await expect(page.getByLabel('Add a task to All')).toBeDisabled()
  await context.setOffline(false)
})

test('TS-A4/A5/A6/A9 v3.3: a list set to “not in All” leaves All but keeps its own view; live on the other device', async ({ browser }) => {
  const user = await createUser('in-all')
  const page = await (await browser.newContext()).newPage()
  const other = await (await browser.newContext()).newPage()
  await openSignedIn(page, user, '/#/lists')
  await newList(page, 'Work')
  await addTask(page, 'Work', 'Quarterly report')
  await newList(page, 'Home')
  await addTask(page, 'Home', 'Fix the tap')
  await openSignedIn(other, user)
  await expect(other.getByRole('link', { name: /Quarterly report/ })).toBeVisible()

  // take Work out of All
  await page.goto('/#/lists')
  await page.getByRole('link', { name: /^Work/ }).click()
  await page.getByRole('button', { name: 'Edit list Work' }).click()
  await expect(page.getByRole('dialog').getByLabel('Show in All')).toHaveValue('yes')
  await page.getByRole('dialog').getByLabel('Show in All').selectOption('no')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect
    .poll(async () => (await restAs(user, 'todo_lists?select=name,show_in_all&order=name')).body)
    .toEqual([
      { name: 'Home', show_in_all: true },
      { name: 'Work', show_in_all: false },
    ])
  await page.goto('/#/lists')
  await expect(page.getByRole('link', { name: /^Work/ })).toContainText('not in All')
  await expect(page.getByRole('link', { name: /^Home/ })).not.toContainText('not in All')

  // the other device: All drops Work's task at once; the list itself still shows it
  await expect(other.getByRole('link', { name: /Quarterly report/ })).toHaveCount(0, { timeout: 10_000 })
  await expect(other.getByRole('link', { name: /Fix the tap/ })).toBeVisible()
  await other.getByRole('button', { name: 'Show tasks from: All' }).click()
  await other.getByRole('button', { name: /^Work/ }).click()
  await expect(other.getByRole('link', { name: /Quarterly report/ })).toBeVisible()
})

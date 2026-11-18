import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSettingsSection, openSignedIn, restAs } from './helpers.js'
import { localStack } from './local-stack.js'

// v3.9 (owner): calendars on Dawn – Settings → Calendars, the private
// address, events written by the server, the Calendar card.
const shot = (page, name) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true })

// A date key `offset` days from today, in the tests' time zone.
const dayKey = (offset) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' })
// What calendar-sync does after reading a calendar (server rights).
async function storeAsServer(source, events, syncError = null) {
  const stack = localStack()
  const response = await fetch(`${stack.url}/rest/v1/rpc/store_calendar_events`, {
    method: 'POST',
    headers: { apikey: stack.admin, Authorization: `Bearer ${stack.admin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, events, sync_error: syncError }),
  })
  if (!response.ok) throw new Error(`store_calendar_events: ${response.status} ${await response.text()}`)
}

test('v3.9 calendars: add one in Settings, the address stays private, events show on Dawn', async ({ page }) => {
  const user = await createUser('calendars')
  await openSignedIn(page, user, '/#/dawn')
  // on to start with: the card explains how to add a calendar
  await expect(page.locator('.card-section-title')).toHaveText(['Calendar', 'Due & overdue'])
  await expect(page.getByText(/No calendar yet/)).toBeVisible()

  // Settings → Calendars: an address that isn't https is refused right away
  await page.goto('/#/settings')
  await openSettingsSection(page, 'Calendars')
  await page.getByLabel('Calendar name').fill('Work')
  await page.getByLabel('Calendar colour').selectOption('sky')
  await page.getByLabel('Secret address in iCal format').fill('http://calendar.example.com/a.ics')
  await page.getByRole('button', { name: 'Add calendar' }).click()
  await expect(page.getByRole('alert')).toContainText('must start with https://')

  // a webcal address is saved as https; it can't be read here, so the reason shows
  await page.getByLabel('Secret address in iCal format').fill('webcal://calendar.example.invalid/private-abc/basic.ics')
  await page.getByRole('button', { name: 'Add calendar' }).click()
  await expect(page.getByLabel('Name of calendar Work')).toBeVisible()
  const [source] = (await restAs(user, 'calendar_sources?select=*')).body
  expect(source).toMatchObject({ name: 'Work', color: 'sky', enabled: true })
  expect(JSON.stringify(source)).not.toContain('example.invalid')
  await expect(page.locator('.calendar-error')).toBeVisible({ timeout: 20_000 })
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])

  // the server stores events: today a meeting, tomorrow a birthday
  await storeAsServer(source.id, [
    { uid: 'a', all_day: false, starts_at: `${dayKey(0)}T08:30:00Z`, ends_at: `${dayKey(0)}T09:00:00Z`, title: 'Stand-up', location: 'Teams' },
    { uid: 'b', all_day: true, start_day: dayKey(1), end_day: dayKey(2), title: 'Lisa’s birthday' },
    { uid: 'c', all_day: false, starts_at: `${dayKey(10)}T08:30:00Z`, ends_at: `${dayKey(10)}T09:00:00Z`, title: 'Too far ahead' },
  ])
  await page.goto('/#/dawn')
  await page.reload()
  const card = page.locator('.calendar-section')
  await expect(card.getByRole('region', { name: /^Today · / })).toContainText('Stand-up')
  await expect(card.getByRole('region', { name: /^Tomorrow · / })).toContainText('Lisa’s birthday')
  await expect(card.getByText('all day')).toBeVisible()
  await expect(card.getByText('Too far ahead')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Calendar/ })).toContainText('1 today')
  await shot(page, 'dawn-calendar')
  const dawnAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(dawnAxe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])

  // switched off in Settings: its events leave Dawn
  // (the reload above started a new visit: the sections are folded again)
  await page.goto('/#/settings')
  await openSettingsSection(page, 'Calendars')
  await page.getByRole('button', { name: 'Show Work' }).click()
  await expect.poll(async () => (await restAs(user, 'calendar_sources?select=enabled')).body[0]?.enabled).toBe(false)
  await page.goto('/#/dawn')
  await expect(page.locator('.calendar-section').getByText('Stand-up')).toHaveCount(0)
})

test('v3.9 calendars: another user sees nothing and the app can’t write events', async ({ page }) => {
  const owner = await createUser('cal-owner')
  const other = await createUser('cal-other')
  await openSignedIn(page, owner, '/#/settings')
  await openSettingsSection(page, 'Calendars')
  await page.getByLabel('Calendar name').fill('Family')
  await page.getByLabel('Secret address in iCal format').fill('https://calendar.example.invalid/family.ics')
  await page.getByRole('button', { name: 'Add calendar' }).click()
  await expect(page.getByLabel('Name of calendar Family')).toBeVisible()
  expect((await restAs(other, 'calendar_sources?select=id')).body).toEqual([])
  const [source] = (await restAs(owner, 'calendar_sources?select=id')).body
  const forged = await restAs(owner, 'calendar_events', { method: 'POST', body: JSON.stringify({ source_id: source.id, user_id: owner.id, all_day: true, start_day: dayKey(0), end_day: dayKey(1), title: 'Forged' }) })
  expect(forged.status).toBeGreaterThanOrEqual(400)
})

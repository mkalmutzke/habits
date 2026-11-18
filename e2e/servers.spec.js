import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, openSettingsSection, openSignedIn, restAs } from './helpers.js'
import { localStack } from './local-stack.js'

// v3.8 (owner): server health – the module switch, adding a server in
// Settings (token shown once), a report from the agent, the header dot and
// the window.
const shot = (page, name) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true })

// What the health agent sends (scripts/server-agent/habits-agent.sh).
const REPORT = {
  cpu: 12.4,
  load1: 0.31,
  load5: 0.28,
  load15: 0.22,
  memory_used_mb: 3174,
  memory_total_mb: 8192,
  disk_used_gb: 130,
  disk_total_gb: 160,
  uptime_s: 2_000_000,
  services: [
    { name: 'nginx', active: true },
    { name: 'docker', active: true },
  ],
  containers_running: 7,
  containers_total: 7,
  updates_pending: 12,
  reboot_required: true,
  cert_days: 54,
}

const sendReport = (agentToken, report = REPORT) =>
  fetch(`${localStack().url}/functions/v1/server-ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  })

test('v3.8 server health: switch on, add a server, the agent reports, the icon and window show it', async ({ page }) => {
  const user = await createUser('servers')
  await openSignedIn(page, user)
  // off to start with
  await expect(page.getByRole('button', { name: /^Servers/ })).toHaveCount(0)

  await page.goto('/#/settings')
  await openSettingsSection(page, 'Modules')
  await page.getByRole('button', { name: 'Server health' }).click()
  await expect.poll(async () => (await restAs(user, 'user_settings?select=server_display')).body[0]?.server_display).toBe('icon')

  // Settings → Servers: add one; the install steps show its token once
  await openSettingsSection(page, 'Servers')
  await page.getByLabel('Server name').fill('vps-zrh-1')
  await page.getByLabel('Hosting provider').selectOption('netcup')
  await page.getByRole('button', { name: 'Add server' }).click()
  const steps = page.getByRole('region', { name: 'Install the agent on vps-zrh-1' })
  await expect(steps).toBeVisible()
  await expect(steps.getByText(/sudo sh habits-install\.sh http:\/\/127\.0\.0\.1:54321\/functions\/v1\/server-ingest/)).toBeVisible()
  const agentToken = (await steps.getByLabel('Server token').textContent()).trim()
  expect(agentToken).toMatch(/^[0-9a-f]{64}$/)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])
  await steps.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByLabel('Server token')).toHaveCount(0)

  // the agent: a wrong token is refused, the right one stored, a second report too soon refused
  expect((await sendReport('0'.repeat(64))).status).toBe(401)
  expect((await sendReport(agentToken)).status).toBe(200)
  expect((await sendReport(agentToken)).status).toBe(429)

  // the header icon: disk 81 % is above the 80 % limit → amber, and the window explains it
  await page.goto('/#/today')
  const icon = page.getByRole('button', { name: 'Servers – needs a look' })
  await expect(icon).toBeVisible({ timeout: 10_000 })
  await icon.click()
  const window = page.getByRole('dialog', { name: 'Servers' })
  await expect(window.getByRole('status')).toContainText('Disk at 81 % – above your 80 % limit')
  await expect(window.getByText('3.1 / 8.0 GB')).toBeVisible()
  await expect(window.getByText('7 of 7 containers running')).toBeVisible()
  await expect(window.getByText('12 updates pending · restart needed')).toBeVisible()
  await page.waitForTimeout(400)
  await shot(page, 'server-window')
  const windowAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(windowAxe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])
  await window.getByRole('button', { name: 'Close' }).click()

  // a higher disk limit in Settings: all healthy (green)
  await page.goto('/#/settings')
  await page.getByLabel('Disk warning at').selectOption('85')
  await page.goto('/#/today')
  await expect(page.getByRole('button', { name: 'Servers – all healthy' })).toBeVisible()
})

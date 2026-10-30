import { expect, test } from '@playwright/test'
import { authEmail, createUser, hasEmail, latestCode, openSignedIn } from './helpers.js'

// Test plan TS-A (sign-in, staying signed in) and v3.2 (owner only: sign-in
// by code, no new accounts, change email with two codes).

test('TS-A1 sign in with the 8-digit code from the email and land on What’s up?', async ({ page }) => {
  const user = await createUser('code')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /on every device/ })).toBeVisible()
  await expect(page.getByText('This app is private.')).toBeVisible()
  await page.getByLabel('Email address').fill(user.email)
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText(/a code is on its way/)).toBeVisible()
  await expect(page.getByLabel('Code from the email')).toBeFocused()

  // a wrong code is refused
  await page.getByLabel('Code from the email').fill('00000000')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText(/wrong or has expired/)

  await page.getByLabel('Code from the email').fill(await latestCode(user.email))
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'What’s up?' })).toBeVisible()
})

test('v3.2 an unknown address gets no email and no account – and the screen does not tell', async ({ page }) => {
  const stranger = `stranger-${Date.now()}@e2e.test`
  await page.goto('/')
  await page.getByLabel('Email address').fill(stranger)
  await page.getByRole('button', { name: 'Send code' }).click()
  // the same neutral answer as for the owner – nobody can probe which addresses exist
  await expect(page.getByText(/a code is on its way/)).toBeVisible()
  await page.waitForTimeout(3000)
  expect(await hasEmail(stranger)).toBe(false)
})

test('TS-A2 stays signed in after closing and reopening the app', async ({ page }) => {
  const user = await createUser('stay')
  await openSignedIn(page, user)
  await expect(page.getByRole('heading', { name: 'What’s up?' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'What’s up?' })).toBeVisible()
})

test('TS-A3 sign out removes the session and the device copy', async ({ page }) => {
  const user = await createUser('out')
  await openSignedIn(page, user, '/#/settings')
  await expect(page.getByText(`Signed in as ${user.email}`)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Send code' })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith('habits-v2-cache') || key.includes('auth-token')),
      ),
    )
    .toEqual([])
})

test('v3.2 change email: code to the current address, then to the new one', async ({ page }) => {
  const user = await createUser('move')
  const newEmail = `moved-${Date.now()}@e2e.test`
  await openSignedIn(page, user, '/#/settings')
  await page.getByRole('button', { name: 'Change email' }).click()
  await page.getByLabel('New email address').fill(newEmail)

  // step 1: a code to the CURRENT address
  let sentAt = Date.now() - 1000
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('Step 1 of 2')).toBeVisible()
  await page.getByLabel(`Code sent to ${user.email}`).fill(await latestCode(user.email, { after: sentAt }))
  sentAt = Date.now() - 1000
  await page.getByRole('button', { name: 'Confirm' }).click()

  // step 2: a code to the NEW address
  await expect(page.getByText(/Step 2 of 2/)).toBeVisible()
  await page.getByLabel(`Code sent to ${newEmail}`).fill(await latestCode(newEmail, { after: sentAt }))
  await page.getByRole('button', { name: 'Change email' }).click()

  await expect(page.getByText(`Done – you now sign in with ${newEmail}`)).toBeVisible()
  await expect.poll(() => authEmail(user)).toBe(newEmail)
})

import { localStack } from './local-stack.js'

// Test users live only in the local stack. Each test makes its own user, so
// tests never see each other's data.
export async function createUser(prefix = 'user') {
  const stack = localStack()
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`
  const password = `pw-${Math.random().toString(36).slice(2)}-A1!`
  const response = await fetch(`${stack.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: stack.admin, Authorization: `Bearer ${stack.admin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (!response.ok) throw new Error(`createUser failed: ${response.status} ${await response.text()}`)
  const user = await response.json()
  return { id: user.id, email, password }
}

// A session for the user, the same as after clicking the email link.
export async function sessionFor(user) {
  const stack = localStack()
  const response = await fetch(`${stack.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: stack.publishable, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  })
  if (!response.ok) throw new Error(`sign-in failed: ${response.status} ${await response.text()}`)
  return response.json()
}

// Opens the app already signed in (puts the session where supabase-js keeps it).
export async function openSignedIn(page, user, path = '/') {
  const session = await sessionFor(user)
  const storageKey = `sb-${new URL(localStack().url).hostname.split('.')[0]}-auth-token`
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value)
    },
    [storageKey, JSON.stringify(session)],
  )
  await page.goto(path)
}

// Calls the Data API as this user (what another device would do).
export async function restAs(user, path, init = {}) {
  const stack = localStack()
  const session = await sessionFor(user)
  const response = await fetch(`${stack.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: stack.publishable,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

// v3.2: the code (8 digits, 6–10 accepted) of the newest email to an address (sign-in or email
// change), from the local mail catcher (Mailpit). `after` skips older emails.
export async function latestCode(email, { after = 0 } = {}) {
  const { mailpit } = localStack()
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`)
    const { messages } = await search.json()
    if (messages?.length && new Date(messages[0].Created).getTime() > after) {
      const message = await (await fetch(`${mailpit}/api/v1/message/${messages[0].ID}`)).json()
      const code = (message.Text || message.HTML).match(/\b\d{6,10}\b/)
      if (code) return code[0]
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`No code email for ${email}`)
}

// Is there any email to this address in the local mail catcher?
export async function hasEmail(email) {
  const { mailpit } = localStack()
  const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`)
  const { messages } = await search.json()
  return Boolean(messages?.length)
}

// The account's email as Supabase Auth has it (admin API).
export async function authEmail(user) {
  const stack = localStack()
  const response = await fetch(`${stack.url}/auth/v1/admin/users/${user.id}`, {
    headers: { apikey: stack.admin, Authorization: `Bearer ${stack.admin}` },
  })
  return (await response.json()).email
}

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

// Connection details of the local Supabase stack (Docker), read from
// `supabase status`. Refuses anything that isn't on this computer, so the
// tests can never touch the real database.
let cached

export function localStack() {
  if (cached) return cached
  const output = execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const status = JSON.parse(output.slice(output.indexOf('{')))
  const url = status.API_URL
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error(`E2E tests only run against the local stack, not ${url}`)
  }
  cached = {
    url,
    publishable: status.PUBLISHABLE_KEY,
    admin: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
    mailpit: status.MAILPIT_URL ?? status.INBUCKET_URL,
    vapidPublicKey: localFunctionSetting('VAPID_PUBLIC_KEY'),
  }
  return cached
}

// A value from the local Edge Function settings (scripts/dev-push-keys.mjs).
function localFunctionSetting(name) {
  const file = new URL('../supabase/functions/.env', import.meta.url)
  if (!existsSync(file)) return ''
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((row) => row.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

// Creates a web push key pair (VAPID) for LOCAL development and CI, and writes
// it into the two settings files that Git ignores:
//   supabase/functions/.env  – read by the local Edge Functions
//   .env.development.local   – read by the app (public key only)
// Does nothing if keys exist already. Never prints the private key.
// The cloud projects get their own keys (Edge Function settings).
import { generateKeyPairSync } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const functionsFile = new URL('../supabase/functions/.env', import.meta.url)
const appFile = new URL('../.env.development.local', import.meta.url)

if (existsSync(functionsFile) && readFileSync(functionsFile, 'utf8').includes('VAPID_PRIVATE_KEY')) {
  console.log('Push keys exist already – nothing changed.')
  process.exit(0)
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
// the public key as browsers expect it: uncompressed point 0x04 | x | y, base64url
const publicRaw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url')

mkdirSync(new URL('../supabase/functions/', import.meta.url), { recursive: true })
appendFileSync(
  functionsFile,
  `# Local web push keys (scripts/dev-push-keys.mjs) – never committed\nVAPID_PUBLIC_KEY=${publicRaw}\nVAPID_PRIVATE_KEY=${privateKey.export({ format: 'jwk' }).d}\nVAPID_SUBJECT=https://habits.mkalmutzke.com\n`,
)
const appSettings = existsSync(appFile) ? readFileSync(appFile, 'utf8') : ''
if (!appSettings.includes('VITE_VAPID_PUBLIC_KEY')) {
  writeFileSync(appFile, `${appSettings}${appSettings && !appSettings.endsWith('\n') ? '\n' : ''}VITE_VAPID_PUBLIC_KEY=${publicRaw}\n`)
}
console.log('Push keys written (local only).')

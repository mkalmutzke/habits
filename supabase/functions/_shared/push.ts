import { buildPushRequest } from './webpush.js'

// Sending web push: encrypted for one device and signed with our
// VAPID key (webpush.js), then handed to the browser's push service – for
// Chrome on Android that's Google's. The private key is a function setting,
// never in the code or the app.

export type Subscription = { id: string; endpoint: string; p256dh: string; auth: string }
export type PushMessage = { title: string; body: string; url: string; tag: string }
export type PushResult = 'sent' | 'failed' | 'gone'

function vapid() {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: Deno.env.get('VAPID_SUBJECT') ?? 'https://habits.mkalmutzke.com' }
}

export function pushConfigured(): boolean {
  return vapid() !== null
}

// 'gone' = the device unsubscribed or the subscription expired (404 / 410):
// the caller deletes it.
export async function sendPush(subscription: Subscription, message: PushMessage): Promise<{ result: PushResult; detail: string }> {
  const keys = vapid()
  if (!keys) return { result: 'failed', detail: 'push keys missing' }
  try {
    const request = await buildPushRequest(subscription, message, keys)
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 404 || response.status === 410) return { result: 'gone', detail: `push ${response.status}` }
    if (response.ok) return { result: 'sent', detail: `push ${response.status}` }
    return { result: 'failed', detail: `push ${response.status} ${(await response.text()).slice(0, 200)}` }
  } catch (error) {
    return { result: 'failed', detail: `push error ${String(error).slice(0, 200)}` }
  }
}

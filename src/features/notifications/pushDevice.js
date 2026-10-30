import { supabase } from '../../shared/data/supabaseClient.js'

// Push on THIS device (design §6: push is switched on per device).
// Switching on asks the browser for permission, creates a subscription at the
// browser's push service and stores it in `push_subscriptions`; switching off
// removes both. Needs the service worker, i.e. the built app (not `npm run dev`).

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : 'unsupported'
}

async function registration() {
  if (!pushSupported()) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

// The browser's subscription on this device, if any.
export async function currentSubscription() {
  const reg = await registration()
  return reg ? reg.pushManager.getSubscription() : null
}

function keyBytes(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function deviceLabel() {
  const ua = navigator.userAgent
  const system = /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : 'Browser'
  return `${system} · ${browser}`
}

export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('This browser can’t receive push notifications.')
  if (!VAPID_PUBLIC_KEY) throw new Error('Push isn’t set up for this version of the app.')
  const reg = await registration()
  if (!reg) throw new Error('Push needs the installed app version (it isn’t available in development mode).')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked. Allow them in the browser’s site settings, then try again.')
  }
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))
  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: userId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    device_label: deviceLabel(),
  })
  // 23505 = this device is already registered for this user: fine
  if (error && error.code !== '23505') throw error
  return endpoint
}

// Switch push off on this device (also used when signing out, so the next
// person on this device doesn't get the previous person's reminders).
export async function disablePush() {
  const subscription = await currentSubscription()
  if (!subscription) return
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  if (error) throw error
  await subscription.unsubscribe()
}

/// <reference lib="webworker" />
// The service worker: runs in the background, also when the app is
// closed. It keeps the built app files for offline starts, shows push
// notifications and opens the right task when one is tapped.
// It never stores data from the database – that is the app's read-only copy.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// every page address opens the app (it routes itself with #/…)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// "Update available → reload" from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data?.json() ?? {}
  } catch {
    message = { title: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'Reminder', {
      body: message.body || '',
      tag: message.tag || undefined,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: message.url || '/#/today' },
    }),
  )
})

// Tap on a notification: bring the open app to the front and show the task,
// or open the app if it isn't running.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/#/today', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const app = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (app) {
        await app.focus()
        return app.navigate(target)
      }
      return self.clients.openWindow(target)
    })(),
  )
})

import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useState } from 'react'
import { cacheKey } from './deviceCache.js'
import { useRealtime } from './realtime.js'

// The read-only copy on this device: the last loaded data is saved
// per user, so the app opens instantly and can be looked at offline.
// It is only ever *read* back – changes always go to the database.
const CACHE_VERSION = 'v2.1'
// 7 days. Not more: the cache's clean-up timer (gcTime) uses setTimeout, which
// only works up to ~24.8 days – larger values fire at once and throw the
// restored copy away (found by the offline-start test, TS-O3).
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // kept as long as the device copy, so the saved copy is complete
        gcTime: MAX_AGE_MS,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 2,
      },
    },
  })
}

// Wraps the signed-in part of the app. `key={userId}` on this component (see
// App) gives every user a fresh, separate cache – data never mixes between users.
function DataProvider({ userId, children }) {
  const [client] = useState(makeClient)
  const [persister] = useState(() =>
    createSyncStoragePersister({ storage: safeStorage(), key: cacheKey(userId) }),
  )

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: MAX_AGE_MS, buster: CACHE_VERSION }}
    >
      <RealtimeBridge userId={userId} />
      {children}
    </PersistQueryClientProvider>
  )
}

function RealtimeBridge({ userId }) {
  useRealtime(userId)
  return null
}

// localStorage can be missing or blocked (some private modes); then there is
// simply no device copy and everything else still works.
function safeStorage() {
  try {
    const storage = window.localStorage
    storage.getItem('probe')
    return storage
  } catch {
    return undefined
  }
}

export default DataProvider

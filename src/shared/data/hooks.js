import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { useToast } from '../ui/toast.js'
import { flush, refreshWhenIdle, SAVE_KEY } from './refresh.js'
import { applyChange, fetchTable, runChange } from './tables.js'

// The rows of one table (from the device copy first, then fresh from the database).
export function useTable(table) {
  const query = useQuery({ queryKey: [table], queryFn: () => fetchTable(table) })
  return { rows: query.data ?? [], loading: query.isPending, error: query.error }
}

// TanStack Query only listens for *changes* of the connection and assumes
// "online" at start. An app started without a connection must know that at
// once (offline banner, no changes), so the current state is read too.
onlineManager.setEventListener((setOnline) => {
  if (typeof window === 'undefined') return undefined
  const update = () => setOnline(navigator.onLine)
  update()
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
  return () => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  }
})

// Is the device online? (A2: without a connection everything stays visible,
// but changes are switched off – nothing is queued secretly.)
export function useOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  )
}

// Which tables a change touches on this device.
function touchedTables(changes) {
  const tables = changes.flatMap((change) =>
    change.action === 'rpc' ? [...(change.refresh ?? []), ...localChanges([change]).map((inner) => inner.table)] : [change.table],
  )
  return [...new Set(tables)]
}

// Saves reach the database one after the other, in the order they were made
// (the screen still updates at once). Otherwise "tick this task" could
// overtake the "repeat weekly" change made a moment before.
let queue = Promise.resolve()
function inOrder(task) {
  const run = queue.then(task)
  queue = run.catch(() => {})
  return run
}

// The local (optimistic) part of a list of changes.
function localChanges(changes) {
  return changes.flatMap((change) => (change.action === 'rpc' ? (change.optimistic ?? []) : [change]))
}

// save(changes): shows the result on screen at once, then writes it to the
// database. If the write fails, the screen goes back to how it was and a short
// message explains why. A change looks like
//   { table, action: 'insert' | 'update' | 'delete' | 'upsert', values, match }
//   { action: 'rpc', fn, args, optimistic: [changes…], refresh: [tables…] }
// `localOnly: true` marks a change that only updates the screen (the database
// does it by itself, e.g. cascading deletes).
export function useSave() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const online = useOnline()

  const mutation = useMutation({
    mutationKey: SAVE_KEY,
    // A2: never wait for the connection and send later.
    networkMode: 'always',
    mutationFn: (changes) =>
      inOrder(async () => {
        for (const change of changes) {
          if (!change.localOnly) await runChange(change)
        }
      }),
    onMutate: async (changes) => {
      const tables = touchedTables(changes)
      await Promise.all(tables.map((table) => queryClient.cancelQueries({ queryKey: [table] })))
      const before = tables.map((table) => [table, queryClient.getQueryData([table])])
      for (const change of localChanges(changes)) {
        queryClient.setQueryData([change.table], (rows) => applyChange(rows, change))
      }
      return { before }
    },
    onError: (error, _changes, context) => {
      for (const [table, rows] of context?.before ?? []) queryClient.setQueryData([table], rows)
      toast.show(messageFor(error), { tone: 'error' })
    },
    onSettled: (_data, _error, changes) => {
      refreshWhenIdle(queryClient, touchedTables(changes))
      // isMutating still counts this save while onSettled runs
      if (queryClient.isMutating({ mutationKey: SAVE_KEY }) <= 1) flush(queryClient)
    },
  })

  const { mutate } = mutation
  return useCallback(
    (changes) => {
      if (!online) {
        toast.show('You’re offline – changes need a connection.', { tone: 'error' })
        return false
      }
      mutate([changes].flat())
      return true
    },
    [online, mutate, toast],
  )
}

function messageFor(error) {
  const text = String(error?.message ?? '')
  if (/fetch|network|Failed to/i.test(text)) return 'Couldn’t save – check your connection and try again.'
  if (/JWT|auth/i.test(text)) return 'Couldn’t save – please sign in again.'
  return 'Couldn’t save – please try again.'
}

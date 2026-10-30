// Tables that changed while one of our own saves was still running. Reloading
// them at that moment could briefly bring back the old state on screen, so the
// reload waits until no save is running any more.
const waiting = new Set()

export const SAVE_KEY = ['save']

export function refreshWhenIdle(queryClient, tables) {
  for (const table of tables) waiting.add(table)
  if (queryClient.isMutating({ mutationKey: SAVE_KEY }) > 0) return
  flush(queryClient)
}

// Called when the last running save has finished.
export function flush(queryClient) {
  const tables = [...waiting]
  waiting.clear()
  for (const table of tables) queryClient.invalidateQueries({ queryKey: [table] })
}

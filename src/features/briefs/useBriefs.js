import { useMemo } from 'react'
import { update } from '../../shared/data/changes.js'
import { useSave, useTable } from '../../shared/data/hooks.js'

// The latest brief of each kind (v3.6), as stored by brief-ingest – the app
// only reads them and marks them as seen (which hides the amber dot on all
// devices, owner).
export function useBriefs() {
  const { rows, loading } = useTable('briefs')
  const save = useSave()
  const byKind = useMemo(() => Object.fromEntries(rows.map((row) => [row.kind, row])), [rows])

  function markSeen(kind, today) {
    const brief = byKind[kind]
    if (brief && brief.seen_on !== today) save(update('briefs', brief.id, { seen_on: today }))
  }

  return { byKind, loading, markSeen }
}

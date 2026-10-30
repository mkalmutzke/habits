import { useMemo } from 'react'
import { insert, newId, nextPosition, nowIso, remove, update } from '../../shared/data/changes.js'
import { useSave, useTable } from '../../shared/data/hooks.js'
import { sortItems } from './shopping.js'

// The shopping list from the database (table `shopping_items`, v3). Every
// change shows at once and is saved straight away (useSave: undone on screen
// if the database says no).
export function useShopping(userId) {
  const table = useTable('shopping_items')
  const save = useSave()
  const items = useMemo(() => sortItems(table.rows), [table.rows])

  const addItem = (title) =>
    save(insert('shopping_items', { id: newId(), user_id: userId, title, ticked_at: null, position: nextPosition(table.rows), created_at: nowIso() }))

  const toggleItem = (item) => save(update('shopping_items', item.id, { ticked_at: item.ticked_at ? null : nowIso() }))

  const renameItem = (item, title) => save(update('shopping_items', item.id, { title }))

  // Removes all ticked items and returns them, so they can be put back (Undo).
  function clearTicked() {
    const ticked = table.rows.filter((row) => row.ticked_at)
    if (ticked.length > 0) save(ticked.map((row) => remove('shopping_items', row.id)))
    return ticked
  }

  // (updated_at is left out: the database sets it)
  function restoreItems(rows) {
    if (rows.length > 0) save(insert('shopping_items', rows.map(({ updated_at: _updatedAt, ...row }) => row)))
  }

  return { items, loading: table.loading, addItem, toggleItem, renameItem, clearTicked, restoreItems }
}

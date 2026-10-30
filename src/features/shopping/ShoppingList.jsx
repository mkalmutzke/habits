import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'
import Icon from '../../shared/ui/Icon.jsx'
import { useToast } from '../../shared/ui/toast.js'
import { cleanTitle } from './shopping.js'
import ShoppingItem, { RenameField } from './ShoppingItem.jsx'
import './shopping.css'

// The shopping list on the Week page (design v3 §2.5): plain text only. ＋
// opens the input; adding an item closes it again – the next item needs ＋
// again (owner, v3.1); tap = ticked (struck
// through, moves to the bottom), tap again = back; long-press (or F2) =
// rename (owner, review point 4); "Clear ticked" removes the ticked ones,
// with Undo. v3.3 (R4): a foldable card like Habits, open at app start,
// with "n to buy" in the header and "Clear ticked" at the bottom.
function ShoppingList({ shopping }) {
  const online = useOnline()
  const { items, addItem, toggleItem, renameItem, clearTicked, restoreItems } = shopping
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState(null)
  const section = useSectionOpen('shopping', true)
  const hasTicked = items.some((item) => item.ticked_at)
  const toBuy = items.length - items.filter((item) => item.ticked_at).length

  function handleAdd(event) {
    event.preventDefault()
    const title = cleanTitle(draft)
    if (!title) return
    addItem(title)
    setDraft('')
    setAdding(false)
  }

  function toggleAdding() {
    // ＋ on a folded card opens it, so the field can be seen
    if (!adding) section[1](true)
    setAdding(!adding)
  }

  function handleClear() {
    const removed = clearTicked()
    if (removed.length === 0) return
    toast.show(`${removed.length} ticked ${removed.length === 1 ? 'item' : 'items'} cleared`, {
      action: { label: 'Undo', onClick: () => restoreItems(removed) },
    })
  }

  return (
    <CollapsibleSection
      state={section}
      className="shopping"
      title="Shopping"
      summary={`${toBuy} to buy`}
      actions={
        <button
          type="button"
          className="section-icon-button add"
          aria-label={adding ? 'Done adding' : 'Add an item'}
          aria-expanded={adding}
          aria-controls="shopping-new"
          onClick={toggleAdding}
          disabled={!online}
        >
          <Icon name="plus" />
        </button>
      }
    >
      {adding && (
        <form id="shopping-new" className="shopping-new" onSubmit={handleAdd}>
          <input
            // the field opens because you want to type (＋)
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setAdding(false)}
            placeholder="e.g. Oat milk"
            aria-label="New item"
            maxLength={200}
            enterKeyHint="done"
          />
          <button type="submit" className="button-primary" disabled={!cleanTitle(draft)}>
            Add
          </button>
        </form>
      )}

      {items.length === 0 && !adding && <p className="empty-note">Nothing to buy – tap ＋ to add an item.</p>}

      <ul className="shopping-items">
        {items.map((item) =>
          renaming === item.id ? (
            <li key={item.id}>
              <RenameField
                item={item}
                onDone={(title) => {
                  if (title && title !== item.title) renameItem(item, title)
                  setRenaming(null)
                }}
              />
            </li>
          ) : (
            <li key={item.id}>
              <ShoppingItem item={item} onToggle={toggleItem} onRename={() => setRenaming(item.id)} />
            </li>
          ),
        )}
      </ul>

      {hasTicked && (
        <div className="shopping-footer">
          <button type="button" className="text-button" onClick={handleClear} disabled={!online}>
            Clear ticked
          </button>
        </div>
      )}
    </CollapsibleSection>
  )
}

export default ShoppingList

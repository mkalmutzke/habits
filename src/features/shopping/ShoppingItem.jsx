import { useRef, useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { hapticLight, hapticSuccess } from '../../shared/utils/haptics.js'
import { cleanTitle } from './shopping.js'

const LONG_PRESS_MS = 500

// One item: a tap ticks it; holding it for half a second renames it.
function ShoppingItem({ item, onToggle, onRename }) {
  const online = useOnline()
  const timer = useRef(null)
  const longPressed = useRef(false)
  const ticked = Boolean(item.ticked_at)

  function startPress() {
    longPressed.current = false
    timer.current = setTimeout(() => {
      longPressed.current = true
      hapticLight()
      onRename()
    }, LONG_PRESS_MS)
  }

  function endPress() {
    clearTimeout(timer.current)
  }

  function handleClick() {
    // the click that ends a long press only opens the rename field
    if (longPressed.current) return
    if (ticked) hapticLight()
    else hapticSuccess()
    onToggle(item)
  }

  return (
    <button
      type="button"
      className={ticked ? 'shopping-item ticked' : 'shopping-item'}
      aria-pressed={ticked}
      aria-keyshortcuts="F2"
      aria-description="Hold or press F2 to rename"
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'F2') {
          event.preventDefault()
          onRename()
        }
      }}
      disabled={!online}
    >
      <span className="shopping-box" aria-hidden="true" />
      <span className="shopping-title">{item.title}</span>
    </button>
  )
}

// The rename field that replaces an item while it is renamed.
export function RenameField({ item, onDone }) {
  const [value, setValue] = useState(item.title)
  return (
    <form
      className="shopping-new rename"
      onSubmit={(event) => {
        event.preventDefault()
        onDone(cleanTitle(value))
      }}
    >
      <input
        // the field opens because you asked to rename (long-press / F2)
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => onDone(cleanTitle(value))}
        onKeyDown={(event) => event.key === 'Escape' && onDone(null)}
        aria-label={`Rename ${item.title}`}
        maxLength={200}
        enterKeyHint="done"
      />
    </form>
  )
}

export default ShoppingItem

import { byPosition } from '../../shared/utils/position.js'
import { cleanText } from '../../shared/utils/text.js'

// The order of the shopping list (design v3 §2.5, owner decision D8): items
// still to buy in the order they were added, ticked ones at the bottom in
// the order they were ticked.
export function sortItems(items) {
  const open = items.filter((item) => !item.ticked_at).sort(byPosition)
  const ticked = items.filter((item) => item.ticked_at).sort((a, b) => a.ticked_at.localeCompare(b.ticked_at))
  return [...open, ...ticked]
}

// The text of a new or renamed item: trimmed, at most 200 characters, or
// null when nothing is left (nothing is saved then).
export const cleanTitle = (text) => cleanText(text, 200) || null

// Order of items that carry a `position` (habits, lists, tasks, …): moving
// one item changes as few rows as possible.

// Sort order of such items: by position, older first when two share one.
export const byPosition = (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)

// A position between two neighbours (for moving one item without touching others).
export function positionBetween(before, after) {
  if (before === undefined && after === undefined) return 1
  if (before === undefined) return after - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

// What to save when the item at `from` in `ordered` (sorted as on screen)
// moves to `to` (v3.3 §3.2): normally just that item, with a position between
// its new neighbours. Only when the neighbours share a position (older data)
// is the whole list numbered 1, 2, 3, … – and only changed rows are returned.
// Returns [{ id, position }], empty when nothing moves.
export function planMove(ordered, from, to) {
  const last = ordered.length - 1
  if (from === to || from < 0 || to < 0 || from > last || to > last) return []
  const moved = ordered[from]
  const rest = ordered.filter((_, index) => index !== from)
  const before = rest[to - 1]
  const after = rest[to]
  const position = positionBetween(before?.position, after?.position)
  const fits = (!before || position > before.position) && (!after || position < after.position)
  if (fits) return [{ id: moved.id, position }]
  const next = [...rest.slice(0, to), moved, ...rest.slice(to)]
  return next.map((item, index) => ({ id: item.id, position: index + 1, old: item.position })).filter((item) => item.position !== item.old).map(({ id, position }) => ({ id, position }))
}

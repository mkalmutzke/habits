import { useEffect, useRef, useState } from 'react'

const EDGE = 80 // px from the top / bottom of the screen where dragging scrolls the page
const SCROLL_STEP = 10

// Reordering a list by drag and drop, without a library (v3.3).
// Rows carry `data-reorder-row`; each has a grip button that
// gets `gripProps(index)`. While moving, `rowStyle(index)` shifts the rows;
// on drop `onMove(from, to)` is called once.
// - Pointer (finger, mouse, pen): press the grip and drag; the page scrolls
//   near the screen edges.
// - Keyboard: Space/Enter picks up, ↑/↓ move, Space/Enter drops, Esc cancels.
// `announcement` is the text for a live region (screen readers).
export function useDragReorder({ count, onMove, nameOf }) {
  const containerRef = useRef(null)
  const [drag, setDragState] = useState(null) // { from, over, dy, mode, rects }
  const [announcement, setAnnouncement] = useState('')
  // the pointer: where the drag started and the last finger position
  const pointer = useRef(null)
  // the same as `drag`, for event handlers that run before the next render
  const dragRef = useRef(null)

  function setDrag(next) {
    dragRef.current = next
    setDragState(next)
  }

  const rows = () => [...(containerRef.current?.querySelectorAll('[data-reorder-row]') ?? [])]
  const position = (index) => `position ${index + 1} of ${count}`

  function measure() {
    return rows().map((row) => {
      const rect = row.getBoundingClientRect()
      return { top: rect.top + window.scrollY, height: rect.height }
    })
  }

  // Where the lifted row would land: the number of other rows whose middle
  // lies above the lifted row's middle.
  function overFor(rects, from, dy) {
    const middle = rects[from].top + rects[from].height / 2 + dy
    return rects.filter((rect, index) => index !== from && rect.top + rect.height / 2 < middle).length
  }

  function finish(state, cancelled) {
    setDrag(null)
    pointer.current = null
    if (!state) return
    // a plain tap on the grip moves nothing and needs no message
    if (state.mode === 'pointer' && state.over === state.from) return
    if (cancelled || state.over === state.from) {
      setAnnouncement(`Move cancelled. ${nameOf(state.from)} stays at ${position(state.from)}.`)
      return
    }
    setAnnouncement(`${nameOf(state.from)} dropped at ${position(state.over)}.`)
    onMove(state.from, state.over)
  }

  // --- pointer ---------------------------------------------------------
  function onPointerDown(index, event) {
    if (event.button !== 0 || count < 2) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointer.current = { startY: event.clientY + window.scrollY, lastY: event.clientY }
    setDrag({ from: index, over: index, dy: 0, mode: 'pointer', rects: measure() })
  }

  function update(clientY) {
    const state = dragRef.current
    if (state?.mode !== 'pointer' || !pointer.current) return
    pointer.current.lastY = clientY
    const dy = clientY + window.scrollY - pointer.current.startY
    setDrag({ ...state, dy, over: overFor(state.rects, state.from, dy) })
  }

  // near the top or bottom edge, keep scrolling while the finger rests there
  useEffect(() => {
    if (drag?.mode !== 'pointer') return
    let frame
    function step() {
      const y = pointer.current?.lastY
      if (y !== undefined) {
        const delta = y < EDGE ? -SCROLL_STEP : y > window.innerHeight - EDGE ? SCROLL_STEP : 0
        if (delta) {
          window.scrollBy(0, delta)
          update(y)
        }
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // only (re)started when a pointer drag begins or ends; `update` reads refs
  }, [drag?.mode])

  // --- keyboard --------------------------------------------------------
  function onKeyDown(index, event) {
    const state = dragRef.current
    const lifted = state?.mode === 'keyboard' && state.from === index
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (lifted) {
        finish(state, false)
        refocus(state.over)
      } else if (count > 1) {
        setDrag({ from: index, over: index, dy: 0, mode: 'keyboard', rects: measure() })
        setAnnouncement(`${nameOf(index)} picked up, ${position(index)}. Arrow keys move, Space drops, Escape cancels.`)
      }
    } else if (lifted && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      const over = Math.min(count - 1, Math.max(0, state.over + (event.key === 'ArrowUp' ? -1 : 1)))
      setDrag({ ...state, over })
      setAnnouncement(`${nameOf(state.from)}, ${position(over)}.`)
    } else if (lifted && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish(state, true)
    }
  }

  // after a keyboard drop the row moves in the page; keep the focus on its grip
  function refocus(index) {
    requestAnimationFrame(() => rows()[index]?.querySelector('[data-reorder-grip]')?.focus())
  }

  function gripProps(index) {
    return {
      'data-reorder-grip': '',
      'aria-roledescription': 'sortable',
      'aria-pressed': drag?.from === index,
      onPointerDown: (event) => onPointerDown(index, event),
      onPointerMove: (event) => update(event.clientY),
      onPointerUp: () => finish(dragRef.current, false),
      onPointerCancel: () => finish(dragRef.current, true),
      onKeyDown: (event) => onKeyDown(index, event),
      onBlur: () => dragRef.current?.mode === 'keyboard' && finish(dragRef.current, true),
    }
  }

  // How far a row is shifted while something is being moved.
  function rowStyle(index) {
    if (!drag) return undefined
    const { from, over, rects } = drag
    if (index === from) {
      const dy = drag.mode === 'pointer' ? drag.dy : offsetTo(rects, from, over)
      return { transform: `translateY(${dy}px)` }
    }
    const shift = rects[from]?.height ?? 0
    if (from < over && index > from && index <= over) return { transform: `translateY(${-shift}px)` }
    if (from > over && index >= over && index < from) return { transform: `translateY(${shift}px)` }
    return undefined
  }

  return { containerRef, drag, announcement, gripProps, rowStyle }
}

// The distance from row `from` to the place of row `over` (keyboard moves).
function offsetTo(rects, from, over) {
  if (!rects[from] || !rects[over]) return 0
  return over > from ? rects[over].top + rects[over].height - (rects[from].top + rects[from].height) : rects[over].top - rects[from].top
}

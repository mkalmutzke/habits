import { useState } from 'react'

// Open or folded for this visit only, per section: every app start begins
// with `defaultOpen`, but coming back from a task keeps what you had.
const openThisVisit = {}

// [open, setOpen] for one foldable card (CollapsibleSection), remembered for
// this visit under `key`.
export function useSectionOpen(key, defaultOpen = false) {
  const [open, setOpenState] = useState(openThisVisit[key] ?? defaultOpen)
  function setOpen(value) {
    openThisVisit[key] = value
    setOpenState(value)
  }
  return [open, setOpen]
}

// Only for tests: forget what was opened during this "visit".
export function resetSectionMemory() {
  for (const key of Object.keys(openThisVisit)) delete openThisVisit[key]
}

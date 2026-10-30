import { useState } from 'react'

// [draft, setDraft] for a text field that edits a saved value: typing changes
// only the draft; when the saved value changes (here or on another device),
// the draft follows (React's "adjust state when a prop changes" pattern).
export function useDraft(saved) {
  const [draft, setDraft] = useState(saved)
  const [last, setLast] = useState(saved)
  if (last !== saved) {
    setLast(saved)
    setDraft(saved)
  }
  return [draft, setDraft]
}

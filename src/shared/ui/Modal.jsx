import { useEffect, useId, useRef } from 'react'
import './Modal.css'

// A modal built on the browser's native <dialog>: it dims the page, keeps
// keyboard focus inside and closes on Esc without extra code (no UI libraries).
// Clicking the dimmed area outside the box also closes it.
// Pass `onSubmit` to make the body a <form> (Enter submits), `wide` for more room.
function Modal({ open, onClose, title, initialFocusRef, onSubmit, wide = false, children }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const Body = onSubmit ? 'form' : 'div'

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
      initialFocusRef?.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialFocusRef])

  function handleDialogClick(event) {
    if (event.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={wide ? 'modal modal-wide' : 'modal'}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleDialogClick}
    >
      <Body className="modal-body" onSubmit={onSubmit}>
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        {children}
      </Body>
    </dialog>
  )
}

export default Modal

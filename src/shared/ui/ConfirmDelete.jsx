import { useState } from 'react'

// A "Delete …" button that asks once before deleting: the first tap shows the
// question with Keep and the real delete button (habits, lists, groups, a
// task for good, the account). `inline` keeps it on one line (task footer);
// `busy` shows a spinner while the delete is running.
function ConfirmDelete({
  label,
  question,
  onConfirm,
  confirmLabel = 'Delete',
  keepLabel = 'Keep',
  disabled = false,
  confirmDisabled = disabled,
  busy = false,
  inline = false,
}) {
  const [asking, setAsking] = useState(false)
  const Row = inline ? 'span' : 'div'
  return (
    <Row className={inline ? 'delete-row inline' : 'delete-row'}>
      {asking ? (
        <>
          {question && <span className="delete-question">{question}</span>}
          <button type="button" className="button-ghost" onClick={() => setAsking(false)}>
            {keepLabel}
          </button>
          <button type="button" className="button-danger" onClick={onConfirm} disabled={confirmDisabled} aria-busy={busy || undefined}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      ) : (
        <button type="button" className="button-danger" onClick={() => setAsking(true)} disabled={disabled}>
          {label}
        </button>
      )}
    </Row>
  )
}

export default ConfirmDelete

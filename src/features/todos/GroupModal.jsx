import { useRef, useState } from 'react'
import { navigate } from '../../shared/hooks/useRoute.js'
import ConfirmDelete from '../../shared/ui/ConfirmDelete.jsx'
import Modal from '../../shared/ui/Modal.jsx'
import { cleanText } from '../../shared/utils/text.js'

// New group, or rename / delete one (`group` given). Deleting a group keeps
// its lists – they move out of the group.
function GroupModal({ todos, group, onClose }) {
  const inputRef = useRef(null)
  const [name, setName] = useState(group?.name ?? '')

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = cleanText(name, 60)
    if (!trimmed) return
    if (group) todos.updateGroup(group.id, { name: trimmed })
    else todos.addGroup(trimmed)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={group ? 'Edit group' : 'New group'} initialFocusRef={inputRef} onSubmit={handleSubmit}>
      <div className="name-field">
        <input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Personal"
          aria-label="Group name"
          maxLength={60}
        />
      </div>

      {group && (
        <ConfirmDelete
          label="Delete group"
          question="Delete the group? Its lists stay."
          onConfirm={() => {
            todos.deleteGroup(group.id)
            onClose()
            // the group's own page is gone
            navigate('/lists')
          }}
        />
      )}

      <footer className="modal-actions">
        <button type="button" className="button-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={!name.trim()}>
          {group ? 'Save' : 'Create group'}
        </button>
      </footer>
    </Modal>
  )
}

export default GroupModal

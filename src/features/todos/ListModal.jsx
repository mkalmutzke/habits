import { useRef, useState } from 'react'
import { navigate } from '../../shared/hooks/useRoute.js'
import ConfirmDelete from '../../shared/ui/ConfirmDelete.jsx'
import Modal from '../../shared/ui/Modal.jsx'
import { cleanText } from '../../shared/utils/text.js'
import { LIST_COLORS } from './listStyle.js'
import { isInAll } from './sources.js'

// New list, or edit one (`list` given): name, colour, group, whether its
// tasks show in All (v3.3); delete.
// v3 (owner): no icons to choose – a list shows a colour dot.
function ListModal({ todos, list, onClose }) {
  const inputRef = useRef(null)
  const [name, setName] = useState(list?.name ?? '')
  const [color, setColor] = useState(list?.color ?? 'amber')
  const [groupId, setGroupId] = useState(list?.group_id ?? '')
  const [showInAll, setShowInAll] = useState(list ? isInAll(list) : true)
  const taskCount = list ? todos.tasks.filter((task) => task.list_id === list.id).length : 0

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = cleanText(name, 60)
    if (!trimmed) return
    const values = { name: trimmed, color, groupId: groupId || null, showInAll }
    if (list) {
      todos.updateList(list.id, { name: values.name, color, group_id: values.groupId, show_in_all: showInAll })
    } else {
      const id = todos.addList(values)
      navigate(`/list/${id}`)
    }
    onClose()
  }

  function handleDelete() {
    todos.deleteList(list.id)
    onClose()
    navigate('/lists')
  }

  return (
    <Modal open onClose={onClose} title={list ? 'Edit list' : 'New list'} initialFocusRef={inputRef} onSubmit={handleSubmit}>
      <div className="name-field">
        <span className={`list-dot color-${color}`} aria-hidden="true" />
        <input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Home"
          aria-label="List name"
          maxLength={60}
        />
      </div>

      <div className="color-picker" role="group" aria-label="Colour">
        {LIST_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            className={`color-dot color-${option}`}
            aria-pressed={option === color}
            aria-label={option}
            onClick={() => setColor(option)}
          />
        ))}
      </div>

      {todos.groups.length > 0 && (
        <label className="field-stack">
          <span className="field-label">Group</span>
          <select className="input" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">No group</option>
            {todos.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="field-stack">
        <label className="field-label" htmlFor="show-in-all">
          Show in All
        </label>
        <select
          id="show-in-all"
          className="input"
          value={showInAll ? 'yes' : 'no'}
          onChange={(event) => setShowInAll(event.target.value === 'yes')}
          aria-describedby="show-in-all-hint"
        >
          <option value="yes">Yes – its tasks appear in All</option>
          <option value="no">No – only in this list</option>
        </select>
        <span id="show-in-all-hint" className="field-hint">
          {showInAll
            ? 'Its open tasks show up in All on What’s up?.'
            : 'Its tasks stay out of All. They still show in the list itself, Important, Planned and “Due & overdue” on Week.'}
        </span>
      </div>

      {list && (
        <ConfirmDelete
          label="Delete list"
          question={<>Delete “{list.name}”{taskCount > 0 && ` and its ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`}?</>}
          onConfirm={handleDelete}
        />
      )}

      <footer className="modal-actions">
        <button type="button" className="button-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={!name.trim()}>
          {list ? 'Save' : 'Create list'}
        </button>
      </footer>
    </Modal>
  )
}

export default ListModal

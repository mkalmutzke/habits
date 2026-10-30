import { useRef, useState } from 'react'
import ConfirmDelete from '../../shared/ui/ConfirmDelete.jsx'
import Modal from '../../shared/ui/Modal.jsx'
import { cleanText } from '../../shared/utils/text.js'
import { HABIT_ICONS, iconChoices } from './habitIcons.js'
import HabitReminderFields from './HabitReminderFields.jsx'
import { useReminderDraft } from './useReminderDraft.js'

// Pick one of the four icons (D4), type a name, press Enter. The name field is
// focused as soon as the modal opens, and closing without saving discards the input.
// `initialName` / `initialEmoji` pre-fill it (e.g. from a suggestion, or the
// habit being edited); the parent gives the modal a new `key` each time it
// opens, so it always starts fresh. With `onDelete` it edits an existing habit.
// v3 (H6, D3): an optional daily reminder – time and channels; it is sent
// only if the habit isn't done yet that day. `onAdd(name, emoji, reminder)`
// gets { remind_time, channels } or null.
// v3.1: an optional subtitle (second line in the grid); `onAdd` gets
// ({ name, subtitle, emoji }, reminder).
function HabitModal({
  open,
  onClose,
  onAdd,
  onDelete,
  title = 'New habit',
  initialName = '',
  initialEmoji = HABIT_ICONS[0].emoji,
  initialSubtitle = '',
  initialReminder = null,
  defaultTime = '09:00',
  defaultChannels = ['inapp'],
  pushOnThisDevice = false,
}) {
  const inputRef = useRef(null)
  const [name, setName] = useState(initialName)
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? '')
  const [emoji, setEmoji] = useState(initialEmoji)
  const [choices] = useState(() => iconChoices(initialEmoji))
  const reminder = useReminderDraft(initialReminder, defaultTime, defaultChannels)

  function handleClose() {
    setName(initialName)
    setEmoji(initialEmoji)
    onClose()
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, subtitle: cleanText(subtitle, 60), emoji }, reminder.value())
    handleClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      initialFocusRef={inputRef}
      onSubmit={handleSubmit}
    >
      <div className="icon-chips" role="group" aria-label="Icon" style={{ '--chips': choices.length }}>
        {choices.map((option) => (
          <button
            key={option.emoji}
            type="button"
            aria-pressed={option.emoji === emoji}
            className="icon-chip"
            onClick={() => {
              setEmoji(option.emoji)
              inputRef.current.focus()
            }}
          >
            <span>
              <span className="icon-chip-emoji" aria-hidden="true">
                {option.emoji}
              </span>
              <span className="icon-chip-label">{option.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="name-field">
        <span className="name-preview" aria-hidden="true">
          {emoji}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Walk the dog"
          aria-label="Habit name"
          maxLength={40}
          enterKeyHint="done"
        />
      </div>

      <input
        type="text"
        className="input subtitle-field"
        value={subtitle}
        onChange={(event) => setSubtitle(event.target.value)}
        placeholder="Subtitle (optional), e.g. 2 × 20 minutes"
        aria-label="Subtitle (optional)"
        maxLength={60}
      />

      <HabitReminderFields reminder={reminder} pushOnThisDevice={pushOnThisDevice} />

      {onDelete && (
        <ConfirmDelete
          label="Delete habit"
          question="Delete this habit and all its check-offs?"
          onConfirm={() => {
            onDelete()
            onClose()
          }}
        />
      )}

      <footer className="modal-actions">
        <p className="hint">↵ save · esc cancel</p>
        <button type="button" className="button-ghost" onClick={handleClose}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={!name.trim()}>
          Save
        </button>
      </footer>
    </Modal>
  )
}

export default HabitModal

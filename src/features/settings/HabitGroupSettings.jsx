import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { useDragReorder } from '../../shared/hooks/useDragReorder.js'
import { cleanText } from '../../shared/utils/text.js'
import SettingsSection from './SettingsSection.jsx'

const MAX_NAME = 40

// v3.6 (owner): Settings → Habit groups. Rename a group by typing (saved when
// the field is left), drag the grip to reorder, ✕ deletes a group – its
// habits move to the default group, which can be renamed but not deleted.
function HabitGroupSettings({ habits, settings, update }) {
  const online = useOnline()
  const { groups, addGroup, renameGroup, deleteGroup, moveGroup } = habits
  const [newName, setNewName] = useState('')
  const { containerRef, announcement, gripProps, rowStyle } = useDragReorder({
    count: groups.length,
    onMove: moveGroup,
    nameOf: (index) => groups[index]?.name ?? '',
  })
  const countOf = (groupId) => habits.habits.filter((habit) => habit.groupId === groupId).length
  const known = new Set(groups.map((group) => group.id))
  const defaultCount = habits.habits.filter((habit) => !known.has(habit.groupId)).length
  const plural = (count) => `${count} habit${count === 1 ? '' : 's'}`

  function handleAdd(event) {
    event.preventDefault()
    const name = cleanText(newName, MAX_NAME)
    if (!name) return
    addGroup(name)
    setNewName('')
  }

  return (
    <SettingsSection id="habit-groups" title="Habit groups" summary={`${groups.length + 1} groups`}>
      <ul ref={containerRef} className="group-list" aria-label="Habit groups">
        {groups.map((group, index) => (
          <li key={group.id} className="group-row" style={rowStyle(index)} data-reorder-row="">
            <button type="button" className="wg-grip" aria-label={`Move ${group.name}`} disabled={!online || groups.length < 2} {...gripProps(index)}>
              <svg viewBox="0 0 14 18" aria-hidden="true">
                <circle cx="4" cy="3" r="1.6" />
                <circle cx="10" cy="3" r="1.6" />
                <circle cx="4" cy="9" r="1.6" />
                <circle cx="10" cy="9" r="1.6" />
                <circle cx="4" cy="15" r="1.6" />
                <circle cx="10" cy="15" r="1.6" />
              </svg>
            </button>
            <NameField name={group.name} label={`Name of group ${group.name}`} onSave={(name) => renameGroup(group.id, name)} disabled={!online} />
            <span className="group-count">{plural(countOf(group.id))}</span>
            <button type="button" className="group-delete" aria-label={`Delete group ${group.name}`} onClick={() => deleteGroup(group.id)} disabled={!online}>
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
        <li className="group-row is-default">
          <span className="group-grip-space" aria-hidden="true" />
          <NameField
            name={settings.default_habit_group}
            label="Name of the default group"
            onSave={(name) => update({ default_habit_group: name })}
            disabled={!online}
          />
          <span className="group-count">{plural(defaultCount)} · default</span>
        </li>
      </ul>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <form className="group-add" onSubmit={handleAdd}>
        <input
          type="text"
          className="input"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New group, e.g. Garden"
          aria-label="New group name"
          maxLength={MAX_NAME}
          disabled={!online}
        />
        <button type="submit" className="button-outline" disabled={!online || !newName.trim()}>
          Add group
        </button>
      </form>
      <p className="settings-hint">
        Drag to change the order. Deleting a group moves its habits to the default group, which can be renamed but not deleted.
      </p>
    </SettingsSection>
  )
}

// A name you can edit in place; saved when the field is left or Enter is
// pressed. An empty name puts the old one back.
function NameField({ name, label, onSave, disabled }) {
  const [value, setValue] = useState(name)
  const [prevName, setPrevName] = useState(name)
  // a rename from another device shows up here
  if (name !== prevName) {
    setPrevName(name)
    setValue(name)
  }

  function commit() {
    const cleaned = cleanText(value, MAX_NAME)
    if (!cleaned) setValue(name)
    else if (cleaned !== name) onSave(cleaned)
  }

  return (
    <input
      type="text"
      className="group-name"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      aria-label={label}
      maxLength={MAX_NAME}
      disabled={disabled}
    />
  )
}

export default HabitGroupSettings

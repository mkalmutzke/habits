import { useId } from 'react'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import Icon from '../../shared/ui/Icon.jsx'
import HabitWeekGrid from './HabitWeekGrid.jsx'

// v3.6 (owner): the habits in groups – one foldable bar per group with
// "x of y" ticked today; every group is folded at app start and opens and
// closes like the Habits card itself. `groups` comes from groupHabits().
// Dragging reorders the habits inside a group only.
function HabitGroups({ groups, today, onToggle, onEdit, onMove, disabled }) {
  return (
    <div className="habit-groups">
      {groups.map((group) => (
        <HabitGroup key={group.id ?? 'default'} group={group} today={today} onToggle={onToggle} onEdit={onEdit} onMove={onMove} disabled={disabled} />
      ))}
    </div>
  )
}

function HabitGroup({ group, today, onToggle, onEdit, onMove, disabled }) {
  const [open, setOpen] = useSectionOpen(`habit-group-${group.id ?? 'default'}`)
  const id = useId()

  return (
    <div className={open ? 'habit-group open' : 'habit-group'}>
      <h3 className="habit-group-heading">
        <button type="button" className="habit-group-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(!open)}>
          <span className="habit-group-title">{group.name}</span>
          <span className="habit-group-summary">
            {group.done} of {group.habits.length}
          </span>
          <Icon name="chevronDown" className="section-chevron" />
        </button>
      </h3>
      {open && (
        <div id={`${id}-body`} className="habit-group-body">
          <HabitWeekGrid
            habits={group.habits}
            today={today}
            onToggle={onToggle}
            onEdit={onEdit}
            onMove={(from, to) => onMove(from, to, group.habits)}
            disabled={disabled}
            label={`${group.name}, last days`}
          />
        </div>
      )}
    </div>
  )
}

export default HabitGroups

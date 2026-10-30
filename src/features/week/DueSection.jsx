import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'
import TaskList from '../todos/TaskList.jsx'
import { dueDayLabel, dueSoon } from './dueSoon.js'

// "Due & overdue" on the Week page (design v3.3 §3.4): open tasks of every
// list that are overdue or due today and in the next 6 days – overdue first,
// then one group per day. Tick, star and open them like everywhere else.
// Folded at app start (owner Q5).
function DueSection({ todos, today, reminderText }) {
  const section = useSectionOpen('due')
  const { overdue, days, counts } = dueSoon(todos.tasks, today)
  const nothing = counts.overdue + counts.week === 0

  const summary = nothing ? (
    'nothing due'
  ) : (
    <>
      {counts.overdue > 0 && <span className="due-overdue">{counts.overdue} overdue · </span>}
      {counts.week} this week
    </>
  )

  return (
    <CollapsibleSection state={section} className="due-section" title="Due & overdue" summary={summary}>
      {nothing && <p className="empty-note">{todos.loading ? 'Loading…' : 'Nothing overdue or due this week.'}</p>}
      {overdue.length > 0 && (
        <DueGroup label="Overdue" overdue>
          <TaskList tasks={overdue} todos={todos} today={today} listId="due" reminderText={reminderText} />
        </DueGroup>
      )}
      {days.map(({ day, tasks }) => (
        <DueGroup key={day} label={dueDayLabel(day, today)} today={day === today}>
          <TaskList tasks={tasks} todos={todos} today={today} listId="due" reminderText={reminderText} />
        </DueGroup>
      ))}
    </CollapsibleSection>
  )
}

function DueGroup({ label, overdue = false, today = false, children }) {
  const className = ['due-group-label', overdue && 'overdue', today && 'today'].filter(Boolean).join(' ')
  return (
    <div className="due-group">
      <h3 className={className}>{label}</h3>
      {children}
    </div>
  )
}

export default DueSection

import { useEffect, useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'
import Confetti from '../../shared/ui/Confetti.jsx'
import Icon from '../../shared/ui/Icon.jsx'
import { hapticCelebrate, hapticLight, hapticSuccess } from '../../shared/utils/haptics.js'
import EmptyState from './EmptyState.jsx'
import HabitModal from './HabitModal.jsx'
import HabitWeekGrid from './HabitWeekGrid.jsx'
import { MILESTONES, getStreak } from './streak.js'
import { defaultChannels } from '../notifications/reminderTime.js'

const CONFETTI_MS = 1600

// The habit section (design v3 §2.2; v3.1–v3.4 also on Week, `page` tells
// them apart; since v3.5 only on What's up?): a foldable card (v3.3: tap the whole header) with
// "x of y today" and a small ＋; unfolded it shows the habit grid. Folded at
// every app start (owner, v3.1); open or folded is remembered per page for
// the visit. Without any habits it shows the welcome card instead.
function HabitSection({ page, habits: model, today, settings, pushOnThisDevice }) {
  const online = useOnline()
  const { habits, remindersByHabit, addHabit, editHabit, deleteHabit, moveHabit, toggleToday, loading } = model
  // a new reminder starts at the default time with the channels that are on
  const reminderDefaults = {
    defaultTime: settings?.default_remind_time ?? '09:00',
    defaultChannels: defaultChannels(settings ?? { inapp_on: true }, pushOnThisDevice),
    pushOnThisDevice,
  }
  const section = useSectionOpen(`habits-${page}`)
  const setOpen = section[1]
  // what the add dialog starts with, plus a counter that gives it a fresh `key` per opening
  const [adding, setAdding] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confetti, setConfetti] = useState(null)
  const doneToday = habits.filter((habit) => habit.completions.includes(today)).length

  useEffect(() => {
    if (!confetti) return
    const timer = setTimeout(() => setConfetti(null), CONFETTI_MS)
    return () => clearTimeout(timer)
  }, [confetti])

  function openAdd(preset = {}) {
    setAdding((previous) => ({ ...preset, count: (previous?.count ?? 0) + 1 }))
  }

  function fireConfetti(options) {
    setConfetti((previous) => ({ ...options, id: (previous?.id ?? 0) + 1 }))
  }

  // Ticking keeps the v2 celebrations: haptics, big confetti for a milestone
  // (7, 30, 100 days), a small one for the first habit ticked today.
  function handleToggle(habit, day, origin) {
    if (habit.completions.includes(day)) {
      hapticLight()
    } else {
      const newStreak = getStreak([...habit.completions, day], today)
      if (MILESTONES.includes(newStreak) && !MILESTONES.includes(getStreak(habit.completions, today))) {
        hapticCelebrate()
        fireConfetti({ ...origin, count: 70, spread: 260 })
      } else {
        hapticSuccess()
        if (day === today && doneToday === 0) fireConfetti(origin)
      }
    }
    toggleToday(habit.id, day)
  }

  return (
    <>
      <CollapsibleSection
        state={section}
        className="habit-section"
        title="Habits"
        summary={habits.length === 0 ? 'none yet' : `${doneToday} of ${habits.length} today`}
        alwaysOpen={habits.length === 0}
        actions={
          <button type="button" className="section-icon-button add" aria-label="Add a habit" onClick={() => openAdd()} disabled={!online}>
            <Icon name="plus" />
          </button>
        }
      >
        {loading && habits.length === 0 ? (
          <p className="loading-line" aria-busy="true">
            Loading your habits…
          </p>
        ) : habits.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <HabitWeekGrid habits={habits} today={today} onToggle={handleToggle} onEdit={setEditing} onMove={moveHabit} disabled={!online} />
        )}
      </CollapsibleSection>

      {confetti && (
        <Confetti key={`confetti-${confetti.id}`} x={confetti.x} y={confetti.y} count={confetti.count} spread={confetti.spread} />
      )}

      {adding && (
        <HabitModal
          key={`add-${adding.count}`}
          open
          onClose={() => setAdding(null)}
          onAdd={(values, reminder) => {
            addHabit(values, reminder)
            setOpen(true)
          }}
          initialName={adding.name}
          initialEmoji={adding.emoji}
          {...reminderDefaults}
        />
      )}

      {editing && (
        <HabitModal
          key={`edit-${editing.id}`}
          open
          title="Edit habit"
          initialName={editing.name}
          initialEmoji={editing.emoji}
          initialSubtitle={editing.subtitle}
          initialReminder={remindersByHabit.get(editing.id) ?? null}
          {...reminderDefaults}
          onClose={() => setEditing(null)}
          onAdd={(values, reminder) => editHabit(editing.id, values, reminder)}
          onDelete={() => deleteHabit(editing.id)}
        />
      )}
    </>
  )
}

export default HabitSection

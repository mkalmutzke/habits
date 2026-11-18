import { useOnline } from '../../shared/data/hooks.js'
import { MAX_BREAKS_IN_A_ROW } from '../habits/streak.js'
import SettingsSection from './SettingsSection.jsx'

// How many breaks may be picked in the list (per habit and month).
const LIMITS = [1, 2, 3, 4, 5, 6, 8, 10]

// v3.8 (owner): Settings → Habit breaks. A second tap on a done day marks it
// as a break: the streak stays but doesn't grow, and three breaks in a row end
// it. Optional: a limit of breaks per habit and calendar month – no limit to
// start with (owner). Once a habit has used its breaks, a second tap clears
// the day instead.
function HabitBreakSettings({ settings, update }) {
  const online = useOnline()
  const limit = settings.habit_break_limit ?? null

  return (
    <SettingsSection id="habit-breaks" title="Habit breaks" summary={limit == null ? 'no limit' : `${limit} per month`}>
      <div className="settings-card">
        <div className="settings-row">
          <label className="settings-row-text" htmlFor="habit-break-limit">
            <span className="settings-row-label">Breaks per habit and month</span>
            <span className="settings-hint">
              Tap a habit day once for done, again for a break, again to clear it. A break keeps the streak but doesn’t add a
              day; {MAX_BREAKS_IN_A_ROW} breaks in a row end it.
            </span>
          </label>
          <select
            id="habit-break-limit"
            className="input compact"
            value={limit ?? ''}
            onChange={(event) => update({ habit_break_limit: event.target.value === '' ? null : Number(event.target.value) })}
            disabled={!online}
          >
            <option value="">No limit</option>
            {LIMITS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>
    </SettingsSection>
  )
}

export default HabitBreakSettings

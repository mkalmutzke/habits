import CalendarSection from '../calendar/CalendarSection.jsx'
import { calendarShown } from '../settings/modules.js'
import DueSection from './DueSection.jsx'
import './dawn.css'

// The Dawn page (v3.8, owner: the Week page until then; v3.3 §3.4): the tasks
// that are due today or in the next 6 days, or overdue (folded at app start).
// v3.6: Garmin moved to a window opened from the header (GarminWindow).
// v3.8: the shopping list moved to What's up?.
// v3.9 (owner): the Calendar card on top – today and the next 6 days from the
// user's calendars (Settings → Modules → Calendar can hide it).
function DawnView({ todos, calendars, settings, today, reminderText }) {
  return (
    <div className="dawn-page">
      {calendarShown(settings) && <CalendarSection calendars={calendars} today={today} />}
      <DueSection todos={todos} today={today} reminderText={reminderText} />
    </div>
  )
}

export default DawnView

import DueSection from './DueSection.jsx'
import './week.css'

// The Week page (v3.3 §3.4): the tasks that are due or overdue (folded at
// app start). v3.6: Garmin moved to a window opened from the header
// (GarminWindow). v3.8: the shopping list moved to What's up?.
function WeekView({ todos, today, reminderText }) {
  return (
    <div className="week-page">
      <DueSection todos={todos} today={today} reminderText={reminderText} />
    </div>
  )
}

export default WeekView

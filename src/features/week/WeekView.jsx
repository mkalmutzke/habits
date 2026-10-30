import GarminSection from '../garmin/GarminSection.jsx'
import ShoppingList from '../shopping/ShoppingList.jsx'
import DueSection from './DueSection.jsx'
import './week.css'

// The Week page (v3.3 §3.4, v3.5): three foldable cards – Garmin (v3.5, in
// place of Habits, which stay on What's up?; folded at app start), the tasks
// that are due or overdue (folded at app start) and the shopping list (open).
function WeekView({ garmin, todos, shopping, today, reminderText }) {
  return (
    <div className="week-page">
      <GarminSection garmin={garmin} today={today} />
      <DueSection todos={todos} today={today} reminderText={reminderText} />
      <ShoppingList shopping={shopping} />
    </div>
  )
}

export default WeekView

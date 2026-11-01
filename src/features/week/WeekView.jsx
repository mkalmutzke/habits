import ShoppingList from '../shopping/ShoppingList.jsx'
import DueSection from './DueSection.jsx'
import './week.css'

// The Week page (v3.3 §3.4): the tasks that are due or overdue (folded at
// app start) and the shopping list (open). v3.6: Garmin moved to a window
// opened from the header (GarminWindow).
function WeekView({ todos, shopping, today, reminderText }) {
  return (
    <div className="week-page">
      <DueSection todos={todos} today={today} reminderText={reminderText} />
      <ShoppingList shopping={shopping} />
    </div>
  )
}

export default WeekView

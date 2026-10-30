import HabitSection from '../habits/HabitSection.jsx'
import PortfolioSection from '../portfolio/PortfolioSection.jsx'
import TodoSection from './TodoSection.jsx'
import './whatsup.css'

// What's up? (design v3 §2): the IBKR card on top (v3.4), then this week's
// habits – both folded when the app opens – and every open to-do below.
function WhatsUpPage({ portfolio, habits, todos, today, reminderText, settings, pushOnThisDevice }) {
  return (
    <div className="whatsup-page">
      <PortfolioSection portfolio={portfolio} today={today} />
      <HabitSection page="whatsup" habits={habits} today={today} settings={settings} pushOnThisDevice={pushOnThisDevice} />
      <TodoSection todos={todos} today={today} reminderText={reminderText} showDeleted={settings?.show_deleted_tasks ?? true} />
    </div>
  )
}

export default WhatsUpPage

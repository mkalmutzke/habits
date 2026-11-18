import HabitSection from '../habits/HabitSection.jsx'
import PortfolioSection from '../portfolio/PortfolioSection.jsx'
import ShoppingList from '../shopping/ShoppingList.jsx'
import TodoSection from './TodoSection.jsx'
import './whatsup.css'

// What's up? (design v3 §2): the IBKR card on top (v3.4), then this week's
// habits – both folded when the app opens – and every open to-do below.
// v3.8 (owner): the shopping list moved here from Week, between habits and
// to-dos, folded at app start.
function WhatsUpPage({ portfolio, briefButton, habits, todos, shopping, today, reminderText, settings, pushOnThisDevice }) {
  return (
    <div className="whatsup-page">
      <PortfolioSection portfolio={portfolio} today={today} briefButton={briefButton} />
      <HabitSection page="whatsup" habits={habits} today={today} settings={settings} pushOnThisDevice={pushOnThisDevice} />
      <ShoppingList shopping={shopping} />
      <TodoSection todos={todos} today={today} reminderText={reminderText} showDeleted={settings?.show_deleted_tasks ?? true} />
    </div>
  )
}

export default WhatsUpPage

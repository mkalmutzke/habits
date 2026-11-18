import GarminSection from '../garmin/GarminSection.jsx'
import HabitSection from '../habits/HabitSection.jsx'
import PortfolioSection from '../portfolio/PortfolioSection.jsx'
import ShoppingList from '../shopping/ShoppingList.jsx'
import { garminDisplay, ibkrShown } from '../settings/modules.js'
import TodoSection from './TodoSection.jsx'
import './whatsup.css'

// What's up? (design v3 §2): the IBKR card on top (v3.4), then this week's
// habits – both folded when the app opens – and every open to-do below.
// v3.8 (owner): the shopping list moved here from Week, between habits and
// to-dos, folded at app start. v3.8 (Settings → Modules): the IBKR card can
// be hidden, and Garmin can be a card here, under IBKR.
function WhatsUpPage({ portfolio, garmin, briefButton, habits, todos, shopping, today, reminderText, settings, pushOnThisDevice }) {
  return (
    <div className="whatsup-page">
      {ibkrShown(settings) && <PortfolioSection portfolio={portfolio} today={today} briefButton={briefButton} />}
      {garminDisplay(settings) === 'section' && <GarminSection garmin={garmin} today={today} />}
      <HabitSection page="whatsup" habits={habits} today={today} settings={settings} pushOnThisDevice={pushOnThisDevice} />
      <ShoppingList shopping={shopping} />
      <TodoSection todos={todos} today={today} reminderText={reminderText} showDeleted={settings?.show_deleted_tasks ?? true} />
    </div>
  )
}

export default WhatsUpPage

import { lazy, Suspense, useEffect, useState } from 'react'
import AppHeader from './AppHeader.jsx'
import SignInScreen from './features/account/SignInScreen.jsx'
import { useSession } from './features/account/useSession.js'
import { useHabits } from './features/habits/useHabits.js'
import { useShopping } from './features/shopping/useShopping.js'
import NotificationSettings from './features/notifications/NotificationSettings.jsx'
import ReminderRow from './features/notifications/ReminderRow.jsx'
import { useInAppReminders, usePushOnThisDevice, useReminders } from './features/notifications/useReminders.js'
import BriefWindow from './features/briefs/BriefWindow.jsx'
import { BRIEFS, isNew, isOn } from './features/briefs/briefs.js'
import { useBriefs } from './features/briefs/useBriefs.js'
import GarminWindow from './features/garmin/GarminWindow.jsx'
import { useGarmin } from './features/garmin/useGarmin.js'
import { usePortfolio } from './features/portfolio/usePortfolio.js'
import ServerWindow from './features/servers/ServerWindow.jsx'
import { serverStatus, worstTone } from './features/servers/serverStatus.js'
import { useServers } from './features/servers/useServers.js'
import { garminDisplay, ibkrShown, serverShown } from './features/settings/modules.js'
import SettingsView from './features/settings/SettingsView.jsx'
import ListsView from './features/todos/ListsView.jsx'
import ListView from './features/todos/ListView.jsx'
import TaskDetail from './features/todos/TaskDetail.jsx'
import './features/todos/todos.css'
import { isOpen } from './features/todos/smartLists.js'
import { useTodos } from './features/todos/useTodos.js'
import { useSettings, useTimeZoneSetting } from './features/settings/useSettings.js'
import DawnView from './features/dawn/DawnView.jsx'
import WhatsUpPage from './features/whatsup/WhatsUpPage.jsx'
import DataProvider from './shared/data/DataProvider.jsx'
import { useOnline, useTable } from './shared/data/hooks.js'
import { isConfigured } from './shared/data/supabaseClient.js'
import { useRoute } from './shared/hooks/useRoute.js'
import { useNow } from './shared/hooks/useNow.js'
import { useToday } from './shared/hooks/useToday.js'
import ToolButton from './shared/ui/ToolButton.jsx'
import './app.css'

// "How it's built" is only downloaded when it's opened (design v3 §2.6).
const AboutPage = lazy(() => import('./features/about/AboutPage.jsx'))

// The app shell. Sign-in comes first (the data lives in the cloud);
// every signed-in user gets their own data layer and device copy (key = user id).
function App() {
  const { session, loading } = useSession()

  if (!isConfigured) return <SetupMissing />
  if (loading) return <div className="boot" aria-busy="true" aria-label="Loading" />
  if (!session) return <SignInScreen />

  return (
    <DataProvider key={session.user.id} userId={session.user.id}>
      <SignedInApp user={session.user} />
    </DataProvider>
  )
}

function SignedInApp({ user }) {
  const route = useRoute()
  const today = useToday()
  const online = useOnline()
  const habits = useHabits(user.id)
  const todos = useTodos(user.id, today)
  const shopping = useShopping(user.id)
  const portfolio = usePortfolio()
  const garmin = useGarmin()
  const briefs = useBriefs()
  const servers = useServers()
  const now = useNow()
  const reminders = useReminders(user.id)
  const { settings, update: updateSettings } = useSettings(user.id)
  const pushOnThisDevice = usePushOnThisDevice(useTable('push_subscriptions').rows)
  // v3.6: the window opened from an icon ('garmin', 'ibkr', 'jobs', 'world'; v3.8: 'server'), or null
  const [panel, setPanel] = useState(null)
  useTimeZoneSetting(user.id)
  useInAppReminders({
    reminders: reminders.reminders,
    tasks: todos.tasks,
    habitReminders: habits.reminders,
    habits: habits.habits,
    inappOn: settings.inapp_on,
  })

  // Each page starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.view, route.id])

  const isTab = ['today', 'dawn', 'lists'].includes(route.view)
  const tabView = isTab ? route.view : 'today'
  // v3.6: header icons before the gear, on the three main pages only (owner);
  // a brief switched off in Settings has no icon. The amber dot: today's
  // brief not opened yet today.
  const briefButton = (kind, className) =>
    isOn(settings, kind) && (
      <ToolButton key={kind} icon={BRIEFS[kind].icon} label={BRIEFS[kind].title} dot={isNew(briefs.byKind[kind], today)} onClick={() => setPanel(kind)} className={className} />
    )
  // v3.8 (Settings → Modules): the Garmin icon only in its "icon" form; with
  // the IBKR card hidden, the IBKR brief's icon moves to the header.
  // v3.8: server health – the dot shows the worst server (green, amber, red)
  const serverTone = worstTone(servers.servers.map((server) => serverStatus(server, servers.latest.get(server.id), now).tone))
  const SERVER_SPOKEN = { ok: 'all healthy', warn: 'needs a look', down: 'no report', none: null }
  const tools = (
    <>
      {serverShown(settings) && (
        <ToolButton icon="server" label="Servers" tone={serverTone === 'none' ? null : serverTone} status={SERVER_SPOKEN[serverTone]} onClick={() => setPanel('server')} />
      )}
      {garminDisplay(settings) === 'icon' && <ToolButton icon="run" label="Garmin" onClick={() => setPanel('garmin')} />}
      {!ibkrShown(settings) && briefButton('ibkr')}
      {briefButton('jobs')}
      {briefButton('world')}
    </>
  )

  return (
    <main className="app">
      {!online && (
        <p className="offline-banner" role="status">
          Offline – you can look at everything, changes need a connection.
        </p>
      )}

      {isTab ? (
        <>
          <AppHeader
            today={today}
            view={tabView}
            openTasks={todos.tasks.filter(isOpen).length}
            tools={tools}
          />
          {/* key: a new page fades in (it never moves – design v3 §2.1) */}
          <div key={tabView} id="view-panel" role="tabpanel" aria-labelledby={`tab-${tabView}`} className="view-panel">
            {tabView === 'today' && (
              <WhatsUpPage
                portfolio={portfolio}
                garmin={garmin}
                briefButton={briefButton('ibkr', 'section-icon-button')}
                habits={habits}
                todos={todos}
                shopping={shopping}
                today={today}
                reminderText={reminders.reminderText}
                settings={settings}
                pushOnThisDevice={pushOnThisDevice}
              />
            )}
            {tabView === 'dawn' && (
              <DawnView todos={todos} today={today} reminderText={reminders.reminderText} />
            )}
            {tabView === 'lists' && <ListsView todos={todos} today={today} />}
          </div>
          {panel === 'garmin' && <GarminWindow garmin={garmin} today={today} onClose={() => setPanel(null)} />}
          {panel === 'server' && <ServerWindow servers={servers} onClose={() => setPanel(null)} />}
          {panel in BRIEFS && (
            <BriefWindow kind={panel} brief={briefs.byKind[panel]} today={today} onSeen={briefs.markSeen} onClose={() => setPanel(null)} />
          )}
        </>
      ) : (
        <>
          {route.view === 'list' && (
            <ListView listId={route.id} todos={todos} today={today} reminderText={reminders.reminderText} showDeleted={settings.show_deleted_tasks} />
          )}
          {route.view === 'task' && (
            <TaskDetail
              taskId={route.id}
              source={route.query.source}
              todos={todos}
              today={today}
              reminder={
                <ReminderRow
                  task={todos.tasks.find((task) => task.id === route.id) ?? { id: route.id, completed_at: null }}
                  reminder={reminders.byTask.get(route.id)}
                  settings={settings}
                  pushOnThisDevice={pushOnThisDevice}
                  onSet={reminders.setReminder}
                  onRemove={reminders.removeReminder}
                />
              }
            />
          )}
          {route.view === 'settings' && route.id === 'about' && (
            <Suspense fallback={<p className="loading-line">Loading…</p>}>
              <AboutPage />
            </Suspense>
          )}
          {route.view === 'settings' && route.id !== 'about' && (
            <SettingsView user={user} settings={settings} update={updateSettings} habits={habits} servers={servers}>
              <NotificationSettings user={user} settings={settings} update={updateSettings} pushOnThisDevice={pushOnThisDevice} />
            </SettingsView>
          )}
        </>
      )}
    </main>
  )
}

// Shown when the app was built without the Supabase settings (.env.local).
function SetupMissing() {
  return (
    <main className="app sign-in-page">
      <span className="wordmark">Habits</span>
      <p className="sign-in-text">
        This copy of the app has no database connection configured. Add
        VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see README → Setup).
      </p>
    </main>
  )
}

export default App

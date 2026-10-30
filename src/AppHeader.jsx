import { headerLine } from './headerLine.js'
import { navigate } from './shared/hooks/useRoute.js'
import ViewTabs from './shared/ui/ViewTabs.jsx'

const VIEW_OPTIONS = [
  { id: 'today', label: 'What’s up?' },
  { id: 'week', label: 'Week' },
  { id: 'lists', label: 'Lists' },
]

const TITLES = { today: 'What’s up?', week: 'Week', lists: 'Lists' }

// The top row (app name and settings) on every page.
export function TopBar() {
  return (
    <div className="header-top">
      <span className="wordmark">Habits</span>
      <a className="icon-button" href="#/settings" aria-label="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </a>
    </div>
  )
}

// The tab bar (a bar at the bottom on phones, see app.css).
export function TabDock({ view }) {
  return (
    <div className="tab-dock">
      <ViewTabs
        options={VIEW_OPTIONS}
        value={view}
        onChange={(id) => navigate(`/${id}`)}
        label="View"
        controls="view-panel"
      />
    </div>
  )
}

// The header of the three tab pages (design v3 §2.1): always the same three
// lines – top bar, small line, title – so it has the same height on every
// page and nothing below it moves when you switch tabs. It stays on top
// while the page scrolls.
function AppHeader({ today, view, openTasks = 0 }) {
  return (
    <header className="app-header">
      <TopBar />
      <p className="eyebrow header-line">{headerLine(view, today, openTasks)}</p>
      <div className="title-row">
        <h1 className="view-title">{TITLES[view]}</h1>
        <TabDock view={view} />
      </div>
    </header>
  )
}

export default AppHeader

// The building blocks inside the app, as layers: each layer uses the ones below it.
const LAYERS = [
  {
    title: 'App shell',
    path: 'src/',
    blocks: [
      { name: 'App.jsx', role: 'sign-in first, pages, routes (#/…)' },
      { name: 'AppHeader.jsx', role: 'fixed header, gear, tab bar' },
      { name: 'main.jsx', role: 'fonts, styles, service worker' },
    ],
  },
  {
    title: 'Features',
    path: 'src/features/',
    blocks: [
      { name: 'whatsup', role: 'start page: IBKR, Habits + ToDo’s cards' },
      { name: 'habits', role: 'week grid, drag to reorder, dialog, streaks' },
      { name: 'todos', role: 'lists, groups, sources (Show in All), task details' },
      { name: 'week', role: 'Week page: Garmin, Due & overdue, Shopping' },
      { name: 'shopping', role: 'shopping list' },
      { name: 'portfolio', role: 'IBKR card: holdings, day move, TWR (v3.4)' },
      { name: 'garmin', role: 'Garmin card: steps, resting heart rate, activities – 7 days or month (v3.5)' },
      { name: 'notifications', role: 'reminders, push on this device' },
      { name: 'settings', role: 'settings, account' },
      { name: 'account', role: 'sign-in by 8-digit code, change email' },
      { name: 'about', role: 'this page' },
    ],
  },
  {
    title: 'Shared',
    path: 'src/shared/',
    blocks: [
      { name: 'data', role: 'TanStack Query: load, save in order, live updates, device copy' },
      { name: 'ui', role: 'foldable cards, Modal, Confetti, Toast, ViewTabs' },
      { name: 'hooks', role: 'route, today (midnight), open/folded, drag and drop' },
      { name: 'utils / styles', role: 'dates, order (positions), haptics · colours, buttons, fields' },
    ],
  },
  {
    title: 'Server',
    path: 'supabase/',
    blocks: [
      { name: 'migrations', role: 'tables, row level security, scheduler' },
      { name: 'functions', role: 'send-reminders, send-test-notification, ibkr-sync, garmin-sync' },
      { name: 'tests', role: 'database tests (pgTAP)' },
    ],
  },
]

function BlocksDiagram() {
  return (
    <>
      <p className="arch-intro">
        Organised by feature. Each layer only uses the layers below it; shared code never
        depends on a feature. The server part is in its own folder.
      </p>
      <ol className="layers" aria-label="Building blocks, top to bottom">
        {LAYERS.map((layer, index) => (
          <li key={layer.title} className="layer" style={{ '--i': index }}>
            <div className="layer-head">
              <span className="layer-title">{layer.title}</span>
              <span className="layer-path">{layer.path}</span>
            </div>
            <ul className="layer-blocks">
              {layer.blocks.map((block) => (
                <li key={block.name} className="block">
                  <span className="block-name">{block.name}</span>
                  <span className="block-role">{block.role}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div className="stores" style={{ '--i': LAYERS.length }}>
        <div className="store zone-runtime">
          <span aria-hidden="true">💾</span> Device copy
          <span className="store-note">read-only, 7 days · for a quick start and offline</span>
        </div>
        <div className="store zone-data">
          <span aria-hidden="true">☁️</span> Supabase
          <span className="store-note">the only real copy of your data</span>
        </div>
      </div>
    </>
  )
}

export default BlocksDiagram

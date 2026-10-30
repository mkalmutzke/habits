import { Flow, ZoneLegend } from './Flow.jsx'

const ITEMS = [
  { node: { icon: '💻', title: 'Laptop', detail: 'Code · Vite dev server · Supabase in Docker for tests', zone: 'build' } },
  { link: { label: 'git push · a pull request per step' } },
  { node: { icon: '📦', title: 'GitHub', detail: 'mkalmutzke/habits (public) · pull request → main', zone: 'build' } },
  { link: { label: 'Every pull request: lint, tests, build, database and end-to-end tests, Semgrep, gitleaks' } },
  { node: { icon: '⚙️', title: 'Vercel', detail: 'Builds the app · a preview per branch (test database) · main = live', zone: 'build' } },
  { link: { label: 'HTTPS · habits.mkalmutzke.com (DNS at INWX) · security headers' } },
  { node: { icon: '📱', title: 'Your phone', detail: 'React app · service worker (installable, starts offline) · read-only copy for 7 days', zone: 'runtime' } },
  { link: { label: 'HTTPS: sign-in, read on open, save on every tap · WebSocket: live updates', direction: 'both' } },
  { node: { icon: '🗄️', title: 'Supabase (EU, Ireland)', detail: 'Auth (8-digit code by email) · Postgres with row level security · Realtime', zone: 'data' } },
  { link: { label: 'Every minute: scheduler → Edge Function send-reminders' } },
  { node: { icon: '🔔', title: 'Push and email', detail: 'Web Push to your devices · emails via Resend', zone: 'data' } },
  { link: { label: 'Tue–Sat mornings: scheduler → Edge Function ibkr-sync (read-only token)', direction: 'both' } },
  { node: { icon: '📈', title: 'IBKR Flex reports', detail: 'Last trading day + year to date · stored as one snapshot for the IBKR card', zone: 'data' } },
  { link: { label: 'Every 30 minutes: scheduler → Edge Function garmin-sync (personal key)', direction: 'both' } },
  { node: { icon: '⌚', title: 'Garmin Connect', detail: 'Personal API · daily steps, resting heart rate and activities for the Garmin card', zone: 'data' } },
]

// Where everything runs and how the parts talk to each other.
function DeployDiagram() {
  return (
    <>
      <p className="arch-intro">
        The app is a set of files from Vercel. Everything you enter is saved in the cloud
        (Supabase) and appears on all your devices; only reminders and the IBKR and Garmin updates
        need a small server part.
      </p>
      <ZoneLegend />
      <Flow items={ITEMS} label="From the code to your phone and back" />
    </>
  )
}

export default DeployDiagram

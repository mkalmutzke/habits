import { Flow } from './Flow.jsx'

const ITEMS = [
  { node: { icon: '⏱️', title: 'Scheduler (pg_cron)', detail: 'In the database, every minute', zone: 'data' } },
  { link: { label: 'HTTPS call with a token from the Vault' } },
  { node: { icon: '⚙️', title: 'Edge Function send-reminders', detail: 'Claims what is due – nothing is sent twice', zone: 'data' } },
  { link: { label: 'Task reminders at their moment · habit reminders once a day, only if not done' } },
  { node: { icon: '🌙', title: 'Quiet hours?', detail: 'Then it waits until they end', zone: 'data' } },
  { link: { label: 'Push (Web Push, own encryption code) · email (Resend) · up to 3 tries' } },
  { node: { icon: '📱', title: 'Your devices and inbox', detail: 'The open app also shows in-app pop-ups by itself', zone: 'runtime' } },
  { link: { label: 'Every result is written down' } },
  { node: { icon: '📒', title: 'Delivery log', detail: 'Settings → Latest deliveries · kept 30 days', zone: 'data' } },
]

function RemindersDiagram() {
  return (
    <>
      <p className="arch-intro">
        Reminders must also arrive when the app is closed, so the server sends them.
        Times follow your phone’s time zone.
      </p>
      <Flow items={ITEMS} label="How a reminder is sent" />
    </>
  )
}

export default RemindersDiagram

// Server health (v3.8, owner): plain helpers behind the server window and
// the header icon's dot, no React.

// Without a report for this long, a server counts as down ("No report").
export const STALE_MINUTES = 15
// A TLS certificate that ends sooner than this is a warning.
export const CERT_WARN_DAYS = 14
// The CPU line in the window: the last 24 hours.
const CHART_HOURS = 24

const percent = (used, total) => (used == null || !total ? null : Math.round((100 * used) / total))

// The newest report of each server: Map server id → report.
export function latestReports(reports) {
  const latest = new Map()
  for (const report of reports) {
    const known = latest.get(report.server_id)
    if (!known || known.reported_at < report.reported_at) latest.set(report.server_id, report)
  }
  return latest
}

// "4 min", "2 h 5 min", "3 days"
export function formatAge(minutes) {
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${Math.floor(minutes)} min`
  if (minutes < 48 * 60) {
    const hours = Math.floor(minutes / 60)
    const rest = Math.floor(minutes % 60)
    return rest ? `${hours} h ${rest} min` : `${hours} h`
  }
  return `${Math.floor(minutes / 1440)} days`
}

// "23 d 4 h", "5 h 12 min"
export function formatUptime(seconds) {
  if (seconds == null) return '–'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  if (days > 0) return `${days} d ${hours} h`
  return `${hours} h ${Math.floor((seconds % 3600) / 60)} min`
}

// How a server is doing:
//   tone 'none' – no report yet; 'down' – no report for 15 minutes;
//   'warn' – a limit is crossed, a watched service is stopped or the
//   certificate ends soon; 'ok' – all fine.
// `issues` are the warnings (first one = the headline), `notes` the things
// worth knowing that need no action now (updates, restart).
export function serverStatus(server, report, now = new Date()) {
  if (!report) return { tone: 'none', headline: 'Waiting for the first report', issues: [], notes: [] }
  const age = (now.getTime() - new Date(report.reported_at).getTime()) / 60_000
  const issues = []
  const notes = []
  const memory = percent(report.memory_used_mb, report.memory_total_mb)
  const disk = percent(report.disk_used_gb, report.disk_total_gb)
  if (report.cpu != null && report.cpu >= server.cpu_warn) issues.push(`CPU at ${Math.round(report.cpu)} % – above your ${server.cpu_warn} % limit`)
  if (memory != null && memory >= server.memory_warn) issues.push(`Memory at ${memory} % – above your ${server.memory_warn} % limit`)
  if (disk != null && disk >= server.disk_warn) issues.push(`Disk at ${disk} % – above your ${server.disk_warn} % limit`)
  for (const service of report.services ?? []) if (!service.active) issues.push(`${service.name} is not running`)
  if (report.cert_days != null && report.cert_days < CERT_WARN_DAYS) {
    issues.push(report.cert_days < 0 ? 'TLS certificate has expired' : `TLS certificate ends in ${report.cert_days} ${report.cert_days === 1 ? 'day' : 'days'}`)
  }
  if (report.updates_pending > 0) notes.push(`${report.updates_pending} ${report.updates_pending === 1 ? 'update' : 'updates'} pending`)
  if (report.reboot_required) notes.push('restart needed')

  if (age > STALE_MINUTES) return { tone: 'down', headline: `No report for ${formatAge(age)}`, issues, notes, age }
  return { tone: issues.length ? 'warn' : 'ok', headline: issues[0] ?? 'All fine', issues, notes, age, memory, disk }
}

const ORDER = ['none', 'ok', 'warn', 'down']

// The header dot: the worst tone of all servers ('none' without servers).
export function worstTone(tones) {
  return tones.reduce((worst, tone) => (ORDER.indexOf(tone) > ORDER.indexOf(worst) ? tone : worst), 'none')
}

// The CPU line of the last 24 hours as SVG points in a 100 × 24 box
// (oldest left, 0 % at the bottom), or '' with fewer than two reports.
export function cpuLine(reports, serverId, now = new Date()) {
  const from = now.getTime() - CHART_HOURS * 3_600_000
  const points = reports
    .filter((report) => report.server_id === serverId && report.cpu != null && new Date(report.reported_at).getTime() >= from)
    .sort((a, b) => (a.reported_at < b.reported_at ? -1 : 1))
  if (points.length < 2) return ''
  const first = new Date(points[0].reported_at).getTime()
  const span = Math.max(1, now.getTime() - first)
  return points
    .map((report) => {
      const x = (100 * (new Date(report.reported_at).getTime() - first)) / span
      const y = 23 - (22 * Math.min(100, report.cpu)) / 100
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

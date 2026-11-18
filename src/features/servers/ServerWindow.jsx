import { useNow } from '../../shared/hooks/useNow.js'
import Modal from '../../shared/ui/Modal.jsx'
import { cpuLine, formatAge, formatUptime, serverStatus } from './serverStatus.js'
import './servers.css'

const PROVIDERS = { netcup: 'netcup', hetzner: 'Hetzner', other: 'Server' }
const TONE_TEXT = { ok: 'healthy', warn: 'warning', down: 'no report', none: 'waiting' }

// v3.8 (owner): "Servers" – opened from the server icon in the header
// (Settings → Modules → Server health). One block per server with what its
// health agent reported last: status, CPU (and its line over 24 hours),
// load, memory, disk, uptime, the watched services, Docker, the TLS
// certificate and pending updates. Servers are added in Settings → Servers.
function ServerWindow({ servers: model, onClose }) {
  const { servers, reports, latest, loading } = model
  const now = useNow()
  return (
    <Modal open wide className="server-window" onClose={onClose} title="Servers" subtitle={servers.length ? `${servers.length} ${servers.length === 1 ? 'server' : 'servers'} · reports every 5 minutes` : null}>
      {servers.length === 0 ? (
        <p className="empty-note">
          {loading ? 'Loading…' : 'No server yet. Add one in Settings → Servers – a small agent on the server then sends its health every 5 minutes.'}
        </p>
      ) : (
        servers.map((server) => <ServerBlock key={server.id} server={server} report={latest.get(server.id)} line={cpuLine(reports, server.id, now)} now={now} />)
      )}
      <a className="server-manage" href="#/settings" onClick={onClose}>
        Manage servers in Settings
      </a>
    </Modal>
  )
}

function ServerBlock({ server, report, line, now }) {
  const status = serverStatus(server, report, now)
  return (
    <section className="server-block" aria-label={server.name}>
      <header className="server-head">
        <h3>{server.name}</h3>
        <span className="server-sub">
          {PROVIDERS[server.provider]}
          {report ? ` · report ${formatAge(status.age)}${status.age >= 1 ? ' ago' : ''}` : ''}
        </span>
      </header>
      <p className={`server-status tone-${status.tone}`} role="status">
        <span className="server-status-dot" aria-hidden="true" />
        <span className="visually-hidden">{TONE_TEXT[status.tone]}: </span>
        {status.headline}
        {status.issues.length > 1 && <span className="server-more"> (+{status.issues.length - 1} more)</span>}
      </p>
      {report && <ServerFigures report={report} status={status} line={line} />}
    </section>
  )
}

function ServerFigures({ report, status, line }) {
  const memory = status.memory ?? Math.round((100 * report.memory_used_mb) / (report.memory_total_mb || 1))
  const disk = status.disk ?? Math.round((100 * report.disk_used_gb) / (report.disk_total_gb || 1))
  return (
    <>
      <dl className="server-stats">
        <div>
          <dt>CPU</dt>
          <dd className="server-big">{report.cpu == null ? '–' : `${Math.round(report.cpu)} %`}</dd>
          {line && (
            <dd className="server-line">
              <svg viewBox="0 0 100 24" preserveAspectRatio="none" role="img" aria-label="CPU over the last 24 hours">
                <polyline points={line} />
              </svg>
            </dd>
          )}
        </div>
        <div>
          <dt>Load 1 · 5 · 15 min</dt>
          <dd className="server-big">{report.load1 ?? '–'}</dd>
          <dd className="server-small">
            {report.load1 ?? '–'} · {report.load5 ?? '–'} · {report.load15 ?? '–'}
          </dd>
        </div>
        <div>
          <dt>Memory</dt>
          <dd className="server-big">{report.memory_total_mb ? `${(report.memory_used_mb / 1024).toFixed(1)} / ${(report.memory_total_mb / 1024).toFixed(1)} GB` : '–'}</dd>
          <dd>
            <Meter value={memory} />
          </dd>
        </div>
        <div>
          <dt>Disk</dt>
          <dd className="server-big">{report.disk_total_gb ? `${Math.round(report.disk_used_gb)} / ${Math.round(report.disk_total_gb)} GB` : '–'}</dd>
          <dd>
            <Meter value={disk} warn={status.issues.some((issue) => issue.startsWith('Disk'))} />
          </dd>
        </div>
      </dl>
      <ul className="server-list">
        <li>
          <span>Uptime</span>
          <span>{formatUptime(report.uptime_s)}</span>
        </li>
        {(report.services ?? []).map((service) => (
          <li key={service.name}>
            <span>{service.name}</span>
            <span className={service.active ? 'good' : 'bad'}>{service.active ? 'running' : 'stopped'}</span>
          </li>
        ))}
        {report.containers_total != null && (
          <li>
            <span>Docker</span>
            <span>
              {report.containers_running} of {report.containers_total} containers running
            </span>
          </li>
        )}
        {report.cert_days != null && (
          <li>
            <span>TLS certificate</span>
            <span className={report.cert_days < 14 ? 'bad' : 'good'}>{report.cert_days < 0 ? 'expired' : `${report.cert_days} days left`}</span>
          </li>
        )}
        {report.updates_pending != null && (
          <li>
            <span>Updates</span>
            <span className={status.notes.length ? 'note' : 'good'}>{status.notes.length ? status.notes.join(' · ') : 'up to date'}</span>
          </li>
        )}
      </ul>
    </>
  )
}

function Meter({ value, warn = false }) {
  const shown = Math.max(0, Math.min(100, value || 0))
  return (
    <span className={warn ? 'server-meter warn' : 'server-meter'} aria-hidden="true">
      <span style={{ width: `${shown}%` }} />
    </span>
  )
}

export default ServerWindow

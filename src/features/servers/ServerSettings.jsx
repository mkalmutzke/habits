import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import ConfirmDelete from '../../shared/ui/ConfirmDelete.jsx'
import { cleanText } from '../../shared/utils/text.js'
import { NameField } from '../settings/HabitGroupSettings.jsx'
import SettingsSection from '../settings/SettingsSection.jsx'
import InstallSteps from './InstallSteps.jsx'
import './servers.css'

const PROVIDERS = [
  { id: 'netcup', label: 'netcup' },
  { id: 'hetzner', label: 'Hetzner' },
  { id: 'other', label: 'Other provider' },
]
const LIMITS = [
  { column: 'cpu_warn', label: 'CPU warning at', min: 50, max: 100 },
  { column: 'memory_warn', label: 'Memory warning at', min: 50, max: 100 },
  { column: 'disk_warn', label: 'Disk warning at', min: 50, max: 99 },
]

// v3.8 (owner): Settings → Servers – add a server (any hosting provider),
// install its health agent with the token shown once, set the warning
// limits, give it a new token, or delete it. Each user has their own servers.
function ServerSettings({ servers: model }) {
  const online = useOnline()
  const { servers, addServer, renewToken, editServer, deleteServer } = model
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('netcup')
  const [install, setInstall] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleAdd(event) {
    event.preventDefault()
    const cleaned = cleanText(name, 40)
    if (!cleaned) return
    setBusy(true)
    setError(null)
    try {
      const added = await addServer(cleaned, provider)
      setInstall({ name: cleaned, token: added.token })
      setName('')
    } catch {
      setError(servers.length >= 5 ? 'At most 5 servers.' : 'Couldn’t add the server – please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRenew(server) {
    setError(null)
    try {
      setInstall({ name: server.name, token: await renewToken(server.id) })
    } catch {
      setError('Couldn’t make a new token – please try again.')
    }
  }

  return (
    <SettingsSection id="servers" title="Servers" summary={`${servers.length} ${servers.length === 1 ? 'server' : 'servers'}`}>
      <div className="settings-card">
        {servers.map((server) => (
          <div key={server.id} className="server-settings-row">
            <NameField name={server.name} label={`Name of server ${server.name}`} onSave={(value) => editServer(server.id, { name: value })} disabled={!online} />
            <div className="server-limits">
              <label>
                Provider
                <select className="input compact" value={server.provider} onChange={(event) => editServer(server.id, { provider: event.target.value })} disabled={!online}>
                  {PROVIDERS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {LIMITS.map((limit) => (
                <label key={limit.column}>
                  {limit.label}
                  <select className="input compact" value={server[limit.column]} onChange={(event) => editServer(server.id, { [limit.column]: Number(event.target.value) })} disabled={!online}>
                    {Array.from({ length: Math.floor((limit.max - limit.min) / 5) + 1 }, (_, index) => Math.min(limit.max, limit.min + index * 5)).map((value) => (
                      <option key={value} value={value}>
                        {value} %
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="server-actions">
              <button type="button" className="button-ghost" onClick={() => handleRenew(server)} disabled={!online}>
                New token
              </button>
              <ConfirmDelete
                label="Delete server"
                question={`Delete ${server.name} and its reports? Its agent then stops being accepted.`}
                onConfirm={() => deleteServer(server.id)}
                disabled={!online}
              />
            </div>
          </div>
        ))}

        {install ? (
          <InstallSteps name={install.name} token={install.token} onDone={() => setInstall(null)} />
        ) : (
          <form className="server-add" onSubmit={handleAdd}>
            <p className="settings-row-label">Add a server</p>
            <div className="server-add-fields">
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. vps-zrh-1" aria-label="Server name" maxLength={40} />
              <select className="input" value={provider} onChange={(event) => setProvider(event.target.value)} aria-label="Hosting provider">
                {PROVIDERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="server-actions">
              <button type="submit" className="button-primary" disabled={!online || busy || !cleanText(name, 40)} aria-busy={busy || undefined}>
                Add server
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <p className="settings-hint">Works with any Linux server with systemd. The agent reports every 5 minutes; without a report for 15 minutes a server shows as down.</p>
    </SettingsSection>
  )
}

export default ServerSettings

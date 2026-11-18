import Icon from '../../shared/ui/Icon.jsx'
import { useToast } from '../../shared/ui/toast.js'
import { INGEST_URL, INSTALL_URL } from './useServers.js'

// v3.8: how to install the health agent on a server, with its token – shown
// right after adding the server (or after "New token") and never again.
function InstallSteps({ name, token, onDone }) {
  const toast = useToast()
  const command = `curl -fsSL ${INSTALL_URL} -o habits-install.sh && sudo sh habits-install.sh ${INGEST_URL}`

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text)
      toast.show(`${what} copied`)
    } catch {
      toast.show('Couldn’t copy – select the text and copy it by hand.', { tone: 'error' })
    }
  }

  return (
    <div className="server-install" role="region" aria-label={`Install the agent on ${name}`}>
      <p className="settings-row-label">Install the agent on {name}</p>
      <ol>
        <li>
          On the server (Linux with systemd), run:
          <span className="server-code">
            <code>{command}</code>
            <button type="button" className="section-icon-button" aria-label="Copy the command" onClick={() => copy(command, 'Command')}>
              <Icon name="copy" />
            </button>
          </span>
        </li>
        <li>
          When it asks, paste this server token. It is shown only now:
          <span className="server-code">
            <code aria-label="Server token">{token}</code>
            <button type="button" className="section-icon-button" aria-label="Copy the token" onClick={() => copy(token, 'Token')}>
              <Icon name="copy" />
            </button>
          </span>
        </li>
        <li>Press Enter for the suggested services. The first report shows within a minute (server icon in the header).</li>
      </ol>
      <p className="settings-hint">The agent only sends figures. It opens no port and changes nothing on the server. Remove it with “sudo sh habits-install.sh --remove”.</p>
      <div className="server-actions">
        <button type="button" className="button-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}

export default InstallSteps

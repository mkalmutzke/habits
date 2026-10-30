import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { supabase } from '../../shared/data/supabaseClient.js'
import BackLink from '../../shared/ui/BackLink.jsx'
import ConfirmDelete from '../../shared/ui/ConfirmDelete.jsx'
import Icon from '../../shared/ui/Icon.jsx'
import ChangeEmail from '../account/ChangeEmail.jsx'
import { signOut } from '../account/useSession.js'
import { version } from '../../../package.json'
import '../about/about.css'
import { disablePush } from '../notifications/pushDevice.js'
import SwitchRow from './SwitchRow.jsx'
import './settings.css'

// Settings (mockup 6): reminders (passed in as children), to-dos, about, and
// account and data.
function SettingsView({ user, settings, update, children }) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  // Signing out also removes this device's read-only copy.
  async function handleSignOut() {
    setBusy('sign-out')
    try {
      // this device stops receiving this account's reminders
      await disablePush().catch(() => {})
      await signOut()
    } finally {
      // the sign-in screen then removes this device's saved copy
      queryClient.clear()
    }
  }

  async function handleDeleteAccount() {
    setBusy('delete')
    setError(null)
    const { error: rpcError } = await supabase.rpc('delete_my_account')
    if (rpcError) {
      setError('Couldn’t delete the account – please try again.')
      setBusy(null)
      return
    }
    queryClient.clear()
    await signOut()
  }

  return (
    <div className="settings">
      <BackLink href="#/today">What’s up?</BackLink>
      <h1 className="page-title">Settings</h1>

      {children}

      <section className="settings-section" aria-labelledby="todos-heading">
        <h2 id="todos-heading" className="section-label">
          To-dos
        </h2>
        <div className="settings-card">
          <SwitchRow
            label="Show deleted tasks"
            hint="Greyed out under “Deleted”, with Restore. Removed for good after 10 days."
            on={settings.show_deleted_tasks}
            onToggle={() => update({ show_deleted_tasks: !settings.show_deleted_tasks })}
            disabled={!online}
          />
        </div>
      </section>

      <section className="settings-section" aria-labelledby="about-heading">
        <h2 id="about-heading" className="section-label">
          About
        </h2>
        <a className="settings-link" href="#/settings/about">
          <span className="settings-link-text">
            <span>How it’s built</span>
            <span className="settings-hint">Architecture, database, reminders, security, tests</span>
          </span>
          <Icon name="chevronRight" size={16} outline />
        </a>
        <p className="settings-hint">Version {version}</p>
      </section>

      <section className="settings-section" aria-labelledby="account-heading">
        <h2 id="account-heading" className="section-label">
          Account and data
        </h2>
        <div className="settings-card padded">
          <p className="signed-in">
            <span className="status-dot" aria-hidden="true" />
            Signed in as <strong>{user.email}</strong>
          </p>
          <ChangeEmail currentEmail={user.email} />
          <p className="settings-hint">
            You stay signed in on this device until you sign out. Habits and to-dos are saved in the
            cloud and update live on all your devices; without a connection you can still look at
            them.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="button-ghost"
              onClick={handleSignOut}
              disabled={busy !== null}
              aria-busy={busy === 'sign-out'}
            >
              {busy === 'sign-out' && <span className="spinner" aria-hidden="true" />}
              Sign out
            </button>
          </div>
        </div>

        <div className="settings-card padded">
          <ConfirmDelete
            label="Delete my account"
            question="Delete your account with all habits, to-dos and settings? This can’t be undone."
            keepLabel="Keep my account"
            confirmLabel="Delete everything"
            onConfirm={handleDeleteAccount}
            disabled={!online}
            confirmDisabled={busy !== null || !online}
            busy={busy === 'delete'}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

export default SettingsView

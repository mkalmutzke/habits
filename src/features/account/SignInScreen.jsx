import { useEffect, useRef, useState } from 'react'
import { clearDeviceCaches } from '../../shared/data/deviceCache.js'
import { sendSignInCode, verifySignInCode } from './useSession.js'
import './account.css'

// 8 digits (config.toml / dashboard); 6–10 are accepted, so a project that
// still sends Supabase's default 6 digits can't lock anybody out
const MIN_CODE = 6
const MAX_CODE = 10

// The first screen when this device isn't signed in yet. v3.2: the
// app is for its owner only – enter the email, then the code from the
// email. Signed in once, the device stays signed
// in until you sign out.
function SignInScreen() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const codeRef = useRef(null)

  // Nobody is signed in on this device: no saved data may stay behind.
  useEffect(() => {
    clearDeviceCaches()
  }, [])

  useEffect(() => {
    if (sentTo) codeRef.current?.focus()
  }, [sentTo])

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleSend(event) {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    run(async () => {
      await sendSignInCode(address)
      setSentTo(address)
      setCode('')
    })
  }

  function handleVerify(event) {
    event.preventDefault()
    // a successful check signs in; the app switches by itself (useSession)
    run(() => verifySignInCode(sentTo, code))
  }

  return (
    <main className="app sign-in-page">
      <span className="wordmark">Habits</span>
      <h1 className="sign-in-title">Your habits and to-dos, on every device.</h1>

      {sentTo ? (
        <form className="sign-in-card" onSubmit={handleVerify}>
          <p className="sign-in-text" role="status">
            If <strong>{sentTo}</strong> may use this app, a code is on its way. It is valid for 10 minutes.
          </p>
          <label className="field-label" htmlFor="sign-in-code">
            Code from the email
          </label>
          <div className="name-field">
            <input
              ref={codeRef}
              id="sign-in-code"
              className="code-input"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, MAX_CODE))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={MAX_CODE}
              required
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button-primary" disabled={busy || code.length < MIN_CODE} aria-busy={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Sign in
          </button>
          <div className="sign-in-links">
            <button type="button" className="button-ghost" onClick={() => run(() => sendSignInCode(sentTo))} disabled={busy}>
              Send a new code
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setSentTo(null)
                setError(null)
              }}
            >
              Use another email
            </button>
          </div>
        </form>
      ) : (
        <form className="sign-in-card" onSubmit={handleSend}>
          <p className="sign-in-text">This app is private. Sign in with your email – we send you a code, no password.</p>
          <label className="field-label" htmlFor="sign-in-email">
            Email address
          </label>
          <div className="name-field">
            <input
              id="sign-in-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button-primary" disabled={busy || !email.trim()} aria-busy={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      )}
    </main>
  )
}

export default SignInScreen

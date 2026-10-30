import { useState } from 'react'
import { useOnline } from '../../shared/data/hooks.js'
import { allowNewEmail, confirmEmailChange, sendSignInCode, verifySignInCode } from './useSession.js'

// 8 digits by configuration; 6–10 accepted (see SignInScreen)
const MIN_CODE = 6
const onlyDigits = (value) => value.replace(/\D/g, '').slice(0, 10)

// Settings → Account → Change email (v3.2, owner's request). Safe order:
//   1. new address entered → a code goes to the CURRENT address,
//   2. that code entered → the server allows the new address and Supabase
//      sends a code to the NEW address,
//   3. that code entered → the account uses the new address.
// Someone holding only this phone can't do step 2. The allowlist follows the
// change by itself.
function ChangeEmail({ currentEmail }) {
  const online = useOnline()
  const [step, setStep] = useState('idle') // idle → form → current → next → done
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

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

  function reset() {
    setStep('idle')
    setError(null)
    setCode('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (step === 'form') {
      const address = newEmail.trim().toLowerCase()
      if (address === currentEmail.toLowerCase()) {
        setError('That is already your email.')
        return
      }
      run(async () => {
        await sendSignInCode(currentEmail)
        setNewEmail(address)
        setCode('')
        setStep('current')
      })
    } else if (step === 'current') {
      run(async () => {
        await verifySignInCode(currentEmail, code)
        await allowNewEmail(newEmail)
        setCode('')
        setStep('next')
      })
    } else if (step === 'next') {
      run(async () => {
        await confirmEmailChange(newEmail, code)
        setStep('done')
      })
    }
  }

  if (step === 'idle' || step === 'done') {
    return (
      <div className="change-email">
        {step === 'done' && (
          <p className="settings-hint" role="status">
            Done – you now sign in with <strong>{newEmail}</strong>.
          </p>
        )}
        <button type="button" className="button-ghost" onClick={() => setStep('form')} disabled={!online}>
          Change email
        </button>
      </div>
    )
  }

  const codeTarget = step === 'current' ? currentEmail : newEmail

  return (
    <form className="change-email" onSubmit={handleSubmit}>
      {step === 'form' ? (
        <>
          <label className="field-label" htmlFor="new-email">
            New email address
          </label>
          <input
            id="new-email"
            className="input"
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <p className="settings-hint">First you confirm with a code sent to your current address, then with one sent to the new address.</p>
        </>
      ) : (
        <>
          <p className="settings-hint" role="status">
            Step {step === 'current' ? '1' : '2'} of 2
            {step === 'next' && ' – you may also get an email at your current address; that one isn’t needed'}
          </p>
          <label className="field-label" htmlFor="change-email-code">
            Code sent to {codeTarget}
          </label>
          <input
            id="change-email-code"
            className="input code-input"
            value={code}
            onChange={(event) => setCode(onlyDigits(event.target.value))}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-actions">
        <button type="button" className="button-ghost" onClick={reset}>
          Cancel
        </button>
        <button
          type="submit"
          className="button-primary"
          disabled={busy || !online || (step !== 'form' && code.length < MIN_CODE)}
          aria-busy={busy}
        >
          {busy && <span className="spinner" aria-hidden="true" />}
          {step === 'form' ? 'Send code' : step === 'current' ? 'Confirm' : 'Change email'}
        </button>
      </div>
    </form>
  )
}

export default ChangeEmail

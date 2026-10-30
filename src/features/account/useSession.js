import { useEffect, useState } from 'react'
import { supabase } from '../../shared/data/supabaseClient.js'

// The signed-in session of this browser. Supabase keeps it in the browser's
// storage and renews it by itself, so you stay signed in on each device until
// you sign out (design §5.1).
// Returns { session, loading }.
export function useSession() {
  const [state, setState] = useState({ session: null, loading: Boolean(supabase) })

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false })
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return state
}

// v3.2 (owner only): sign-in by an 8-digit code instead of a link. New
// accounts are never created from here (shouldCreateUser: false) – and the
// server refuses them anyway (sign-ups off + allowlist hook).
// For an unknown address no email is sent; the
// screen doesn't tell the difference, so nobody can probe which addresses exist.
export async function sendSignInCode(email) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  if (error && !isUnknownAddress(error)) throw friendlyError(error)
}

export async function verifySignInCode(email, code) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw friendlyError(error)
}

// Changing the account's email (Settings, v3.2) – four steps:
//   1. a sign-in code to the CURRENT address (sendSignInCode) and
//   2. confirming it (verifySignInCode) – the session now proves "signed in
//      by a code just now";
//   3. allowNewEmail: the server puts the new address on the allowlist for
//      30 minutes – only for such a fresh session – and asks Supabase to send
//      a code to the new address;
//   4. confirmEmailChange with that code.
// Supabase alone would change the address after a single code, so steps 1–3
// keep a stolen, signed-in phone from moving the account (owner-only.md).
export async function allowNewEmail(newEmail) {
  const { error: allowError } = await supabase.rpc('allow_email_change', { new_email: newEmail })
  if (allowError) throw friendlyError(allowError)
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) throw friendlyError(error)
}

export async function confirmEmailChange(newEmail, code) {
  const { error } = await supabase.auth.verifyOtp({ email: newEmail, token: code, type: 'email_change' })
  if (error) throw friendlyError(error)
}

function isUnknownAddress(error) {
  return /signups? not allowed|otp_disabled|user not found|private/i.test(`${error.code ?? ''} ${error.message ?? ''}`)
}

function friendlyError(error) {
  const text = `${error.code ?? ''} ${error.message ?? ''}`
  if (/rate|too many|over_email_send_rate_limit|429/i.test(text)) return new Error('Too many attempts – please wait a few minutes.')
  if (/expired|invalid|otp/i.test(text)) return new Error('This code is wrong or has expired. Ask for a new one.')
  if (/already|exists|registered|not allowed/i.test(text)) return new Error('This address can’t be used.')
  if (/current address first/i.test(text)) return new Error('Please confirm with a new code from your current address.')
  return new Error('Something went wrong – please try again.')
}

export async function signOut() {
  // 'local': only this device; other devices stay signed in
  await supabase.auth.signOut({ scope: 'local' })
}

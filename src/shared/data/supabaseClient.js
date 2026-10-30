import { createClient } from '@supabase/supabase-js'

// Both values come from a local settings file that is never committed
// (see README → "Setup"). The publishable key is safe in a web page:
// the database's row level security decides what it may access.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// v2 stores everything in the cloud, so the app can't run without these.
export const isConfigured = Boolean(url && publishableKey)

// The session (stay signed in) is kept in this browser's storage until sign-out.
export const supabase = isConfigured
  ? createClient(url, publishableKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

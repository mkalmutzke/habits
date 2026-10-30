const STACK = [
  ['Screens', 'React 19, plain CSS (no UI library)'],
  ['Data in the app', 'TanStack Query 5, supabase-js'],
  ['Build', 'Vite, vite-plugin-pwa (service worker)'],
  ['Database & sign-in', 'Supabase: Postgres 17, Auth, Realtime, Vault, pg_cron'],
  ['Server code', 'Supabase Edge Functions (Deno), no third-party packages'],
  ['Push / email', 'Web Push (VAPID) · Resend'],
  ['Portfolio data', 'IBKR Flex Web Service (read-only reports, XML)'],
  ['Fitness data', 'Garmin Connect Personal API (personal key, JSON)'],
  ['Hosting', 'Vercel, domain at INWX'],
  ['Tests', 'Vitest, Testing Library, pgTAP, Playwright, axe'],
]

// "Tech stack": the tools and services, and the app version.
function StackSection({ version }) {
  return (
    <>
      <dl className="stack-list">
        {STACK.map(([what, which]) => (
          <div key={what}>
            <dt>{what}</dt>
            <dd>{which}</dd>
          </div>
        ))}
      </dl>
      <p className="arch-footnote">
        Version {version}.
      </p>
    </>
  )
}

export default StackSection

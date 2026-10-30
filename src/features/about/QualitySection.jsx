const POINTS = [
  { title: 'Owner only (v3.2)', text: 'No sign-ups; one allowlisted account; sign-in with an 8-digit code from the email; email changes need a fresh code from the current address.' },
  { title: 'Sign-in', text: 'Code by email, no passwords. You stay signed in on a device until you sign out.' },
  { title: 'Your data only', text: 'Row level security on every table; another account can neither read nor change your rows, also not live.' },
  { title: 'Server values', text: 'The values for push, email, the IBKR token, the Garmin key and full database access live only in Supabase; the app holds only public ones.' },
  { title: 'Portfolio (v3.4)', text: 'The IBKR token can only read reports, never trade. The app can only read the portfolio tables; only the server writes them. Amounts are hidden until you tap the eye.' },
  { title: 'Garmin (v3.5)', text: 'Your personal Garmin key reads only your own Garmin data. Steps, heart rate and activities stay in your EU database, readable only by you, and are never written to any log.' },
  { title: 'Browser', text: 'Security headers (CSP, HSTS, no framing); all text is shown as text, never as HTML.' },
  { title: 'Tests', text: 'Unit and component tests (Vitest), database tests (pgTAP), end-to-end tests in a real browser (Playwright) with accessibility checks (axe).' },
  { title: 'Every pull request', text: 'Lint, tests, build, npm audit, Semgrep (code scan), gitleaks (leak scan), database and end-to-end tests – merged only when all are green.' },
  { title: 'Accessibility', text: 'WCAG AA contrast, keyboard use, screen-reader labels, large tap targets, “reduce motion” respected.' },
]

// "Security & tests": what protects your data and how the app is checked.
function QualitySection() {
  return (
    <ul className="quality-list">
      {POINTS.map((point) => (
        <li key={point.title}>
          <span className="quality-title">{point.title}</span>
          <span className="quality-text">{point.text}</span>
        </li>
      ))}
    </ul>
  )
}

export default QualitySection

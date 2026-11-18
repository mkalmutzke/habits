# Habits

A personal app for **habits, to-dos and a shopping list**, mobile-first and installable on
Android. The start page "What's up?" shows a folded IBKR portfolio card (the day's move; holdings and
performance when opened; a daily morning news brief), the habits in groups (tap a day to tick it, again for a break that keeps the streak), the shopping list (folded) and every
open to-do; the Dawn page (called Week until v3.8) has the tasks due today, in the next 6 days or overdue. Icons in the header open Garmin (steps, resting heart rate, elevation and activities for 7 days or the month; in Settings → Modules it can also be a card on What's up? or hidden, like the IBKR card)
and two daily briefs (job market, world news), written each morning by Claude scheduled tasks. What each brief covers – countries, job titles, regions, symbols, topics, number of items, its name and icon – is set in Settings → Daily briefs. Data lives in the cloud and updates live on
all your devices; reminders arrive by push, email or in the app.

**Live app:** https://habits.mkalmutzke.com/ – sign in with your email, then "Install app" /
"Add to Home Screen".

- How it's built: in the app, Settings → How it's built
- Step-by-step history: [`BUILD_LOG.md`](BUILD_LOG.md) · handoff for the next session: [`docs/NEXT_SESSION.md`](docs/NEXT_SESSION.md)

## Run it locally

You need **Node 24** and **Docker Desktop** (the database runs locally in Docker).

```bash
npm install
npm run db:start        # local Supabase: database, sign-in, Realtime, Edge Functions, Mailpit
npm run dev:push-keys   # once: a local push key pair for the Edge Functions and the app
npm run dev             # then open http://localhost:5173
```

The app needs two public settings in **`.env.development.local`** (not in Git):
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` – `npx supabase status` shows
the local values. Sign-in emails of the local stack appear in Mailpit
(http://127.0.0.1:54324). `.env.example` shows the format.

## Tests

```bash
npm run lint        # oxlint
npm test            # unit and component tests (Vitest)
npm run test:db     # database tests (pgTAP) against the local stack
npm run test:e2e    # end-to-end tests (Playwright + axe) against the local stack
npm run build       # production build into dist/
```

Every pull request runs all of them in GitHub Actions, plus `npm audit`, Semgrep and
gitleaks. The end-to-end tests refuse to run against anything but the local stack.

## Project structure

```
src/
  App.jsx, AppHeader.jsx   app shell: sign-in first, routes, fixed header, tab bar
  features/
    whatsup/               What's up?: IBKR card, Garmin card (optional), habits, shopping list, ToDo's
    portfolio/             IBKR card: newest snapshot, holdings, day move, TWR (read-only)
    habits/                week grid, habit groups, habit dialog (icons, group, daily reminder), streaks
    todos/                 sources, lists, groups, task details, deleted tasks
    dawn/, shopping/       Dawn page (due tasks; Week until v3.8), shopping list
    servers/               server health: window from the header icon, Settings → Servers, status rules
    garmin/                Garmin window from the header: 7 days or month, steps chart, resting heart rate, elevation, activities, Refresh
    briefs/                daily briefs (IBKR, Canada jobs, world news): windows, amber dot, Settings switches
    notifications/         reminders, push on this device, in-app pop-ups
    settings/, about/      Settings, "How it's built"
    account/               sign-in with an 8-digit code by email, change email
  shared/                  data layer (TanStack Query, live updates), UI, hooks, utils, styles
  storage/                 small per-device preferences (localStorage)
supabase/
  migrations/              tables, row level security, functions, scheduler
  functions/               Edge Functions: send-reminders, send-test-notification, ibkr-sync, garmin-sync, brief-ingest, server-ingest
  tests/database/          pgTAP tests
scripts/server-agent/      the server health agent and its installer (runs on your own server)
e2e/                       Playwright tests
docs/NEXT_SESSION.md      where the last session stopped (shown at every session start)
docs/briefs/               how the daily briefs are made, and the scheduled tasks' instructions
```

## Server health (v3.8)

Settings → Modules → **Server health** shows a server icon in the header; its dot is green
(all fine), amber (a limit crossed, a service stopped, the certificate ends within 14 days) or
red (no report for 15 minutes). Settings → **Servers** → *Add server* shows two things once:
the install command and the server's token. On the server (any Linux with systemd – netcup,
Hetzner or any other provider), run the command and paste the token when it asks; it is read
without showing it, so it never lands in the shell history. The agent
(`scripts/server-agent/habits-agent.sh`) then sends CPU, load, memory, disk, uptime, the
watched services, Docker containers, pending updates (Debian/Ubuntu) and the TLS certificate's
days left every 5 minutes to the Edge Function `server-ingest`. It only sends; it opens no port.
The database keeps only the token's fingerprint. Remove the agent with
`sudo sh habits-install.sh --remove`; *New token* in Settings makes the old one stop working.

## Environments and deployment

| | Frontend | Database |
|---|---|---|
| Local | `npm run dev` | Supabase in Docker |
| Test | Vercel preview of each branch (Vercel login) | Supabase project `habits-test` |
| Production | `main` → https://habits.mkalmutzke.com | live Supabase project |

Vercel builds every push (`npm run build`, Node from `engines` in `package.json`). The
public settings `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and
`VITE_VAPID_PUBLIC_KEY` are Vercel environment variables (Production and Preview have
their own). Server-side values (push key pair, Resend, `EMAIL_FROM`, `APP_URL`) are Edge
Function settings in each Supabase project; the scheduler needs the Vault entry
`project_url`.

Database changes are migrations in `supabase/migrations/`, applied with the Supabase CLI –
first to `habits-test`, to production only during a release. Check which
project the CLI is linked to before any `supabase db` command.

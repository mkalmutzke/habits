# Next session – handoff

*Written 18 November 2026 after Step 23. Details: [`BUILD_LOG.md`](../BUILD_LOG.md).*

## Where we stopped

- **v3.8.0 is live** (Steps 14–23, PRs #14 and #15): shopping list on What's up? (folded); habit breaks (tap: done → break → clear, three breaks in a row end the streak, optional monthly limit in Settings → Habit breaks); habit month view (calendar icon on the Habits card); Settings → Modules (IBKR on/off, Garmin off / icon / section, Server health); server health (agent in `scripts/server-agent`, Edge Function `server-ingest`, header icon with status dot, Settings → Servers); the Week page is now **Dawn** (`#/week` still works). 21 migrations, Edge Functions now also `server-ingest`.
- **Checked by the owner (18 Nov):** v3.8 works live; the netcup VPS reports to Server health (agent installed, watching caddy and docker). Still open: tag `v3.8.0` if not pushed yet; CLI back to `habits-test` (and `db push` + `functions deploy server-ingest` there if not done yet).
- **Blocker for every merge into `main`:** `npm audit` is red because of `picomatch` (GHSA-fc5q-39xc-vjpf, ≤ 4.0.7, no fixed version yet, build tools only). The `main` ruleset requires the check, and v3.8 was merged by the owner with "bypass rules". As soon as 4.0.8+ is out: `npm update picomatch`, push, check green.
- **Next topics, in the recommended order** (design page from Step 14, outside the repository): 1) Dawn dark theme (style guide), 2) configurable briefs (icon vs. run, countries, job titles, topics), 3) per-user connections for IBKR/Garmin + invite screen (owner: invite-only), 4) calendars on Dawn via iCal addresses. Later: Google sign-in for calendars, briefs for other users (owner: skip for now), netcup API check, alerts on server status changes.
- **Owner's decisions (Step 15):** breaks don't count as streak days; monthly break limit settable (none to start with); other users invite-only; briefs for others and Google sign-in skipped for now; the agent also checks Docker and updates.

- **Brief tasks** (owner's Claude account, Zurich time, fresh cloud session per run, instructions in [`docs/briefs/`](briefs/README.md)): "Habits – World news brief" daily 07:37, "Habits – Canada jobs brief" daily 07:41, "Habits – IBKR morning brief" Tue–Sat 07:45. Test runs on 1 Nov: world and jobs stored, IBKR correctly skipped (Sunday). Changing a task's text: edit the file in `docs/briefs/`, then update the scheduled task.
- **Open, owner (from v3.6):** widen the Claude environment's network access (or allow the news sites) so the briefs can open articles and link each one – the test runs often had to share one overview link.

- **Fresh start (Step 1):** this repository (`mkalmutzke/habits`, public) starts from the code of v3.5.0 with one commit and no history. The old repository `habit-tracker` was deleted by the owner on 30 Oct (Step 3); its design documents and old build log (Steps 1–153) are in the owner's download.
- **Move done (Step 2):** the app runs at `https://habits.mkalmutzke.com` from this repository; emails come from `…@habits.mkalmutzke.com`. The end-to-end test pattern was fixed for the new folder name.
- The IBKR token and the Garmin key expire around 28 Oct 2027 – renew them in **both** Supabase projects (owner's guide, outside the repository).

## Open, owner's choice

| Item | Recommendation |
|---|---|
| Old address `todo.mkalmutzke.com` | It points to `185.181.104.242`, not Vercel – check at INWX; redirect it to habits.mkalmutzke.com for a while, then remove it (also the old redirect URL in Supabase and the old domain in Resend) |
| Branch protection for `main` | Done: a ruleset requires five checks (seen on 18 Nov). Keep yourself on its bypass list for cases like the `picomatch` audit |
| Calendar reminder for the keys | about 21 Oct 2027 |

## Working agreements

- One PR per step or per small version; every step in `BUILD_LOG.md`. Decisions are explained in the entry's **Why** (no separate design documents in the repository).
- Cloud containers can't log in to Supabase, push tags or open the live site: the owner runs `npx supabase …` on their computer, pushes the tag and checks the live version.
- **Claude merges its own PRs once all checks are green.** Going live and cloud database changes need the owner's explicit OK.
- Answer in the owner's language; short status lines during long work.

## Tooling quirks

- A plugin hook blocks shell commands whose text contains words like "secret", ".env", "key" or "credential" → write such text with the editor tool or into a script file.
- Run the **whole** end-to-end suite locally before pushing (`npx playwright test`, local stack via `npm run db:start`). Before that, run `npm run dev:push-keys` once (as in CI) – without it the reminder tests fail. Database tests after the e2e suite need `npm run db:reset` first (leftover e2e users and servers).
- A new Edge Function is only served locally after `npx supabase stop --no-backup && npm run db:start`.
- Cloud container: Docker may not be running → start it with `dockerd &`; the `pg_prove` image may not download → run the pgTAP files with `psql` inside the database container; Playwright may expect a newer headless browser than the installed one → link the installed one under `/opt/pw-browsers` (local only).
- Force-pushing is blocked in the cloud container → after a PR is merged, merge the release branch (or `main`) into the working branch instead of rebasing.
- Database tests run as the owner and see all rows → tests count only their own rows.
- CI sometimes fails to start Docker (port) – rerun the failed job.
- With `--linked`, the Supabase CLI seemed to ignore `--project-ref` – for production, check in the dashboard.
- Android Chrome may not report a time picked inside a modal dialog → time fields in dialogs are uncontrolled and read on save.

## Starting and ending a session

- **Start:** nothing to type – the session-start hook shows this file, the git state and the latest build-log entry.
- **End:** `/handoff` – updates the build log and this file, commits and pushes.

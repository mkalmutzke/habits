# Next session – handoff

*Written 18 November 2026 after Step 31. Details: [`BUILD_LOG.md`](../BUILD_LOG.md).*

## Where we stopped

- **v3.9.0 is live** (Steps 25–31, PRs #17, #19, #18): **configurable daily briefs** (Settings → Daily briefs: run and icon separately, name, topics, items at most, "also follow"; jobs: countries, job titles, about me; world: regions, leave out; IBKR: extra symbols – stored in `user_settings.brief_prefs`, handed to the runs as `prefs`) and **calendars on Dawn** (Settings → Calendars: secret iCal addresses, up to 10, kept in a private table; Edge Function `calendar-sync` every 15 minutes and on Refresh; Calendar card with today + 6 days). Fix in Step 30: settings saves send only the changed columns, so quick changes no longer undo each other. 23 migrations; Edge Functions now also `calendar-sync`.
- **v3.8.0** (Steps 14–23): habit breaks, month view, Modules, server health (the netcup VPS reports, watching caddy and docker), shopping list on What's up?, Week → Dawn.
- **Open, owner:** copy the new `docs/briefs/jobs.md`, `world.md`, `ibkr.md` into the three scheduled tasks (until then the briefs run with the old text and ignore the new settings); tag `v3.8.0` / `v3.9.0` if not pushed yet; link the CLI back to `habits-test`; add the Google calendar under Settings → Calendars.
- **`npm audit` is green again** since PR #17 (the `picomatch` warning no longer fails). If it turns red again: no bypass by default – first check whether a fixed version exists.
- **Dawn dark theme:** tried on a mockup page (Step 25, "Dawn Theme Studio" on the owner's claude.ai account) and dropped by the owner (Step 26); the app keeps its look.
- **Next topics, in the recommended order:** 1) per-user connections for IBKR/Garmin + invite screen (owner: invite-only) – the biggest step, with a security review. Later: Google sign-in for calendars (needs Google's verification), briefs for other users (owner: skip for now), netcup API check, alerts on server status changes.
- **Matt Pocock's engineering skills** (Step 24) are installed on the owner's computer only: `/mattpocock-skills:code-review <fixed point>`; its spec is the owner's request plus the build log's **Why**. Open question for the owner: allow ADRs under `docs/adr/` (the skills may create them), or keep decisions only in the build log.
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
| Branch protection for `main` | Done: a ruleset requires five checks. Keep yourself on its bypass list for emergencies |
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

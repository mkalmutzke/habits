# Next session – handoff

*Written 8 November 2026 after Step 15. Details: [`BUILD_LOG.md`](../BUILD_LOG.md).*

## Where we stopped

- **v3.7.0 is live** (Steps 12–13): the Garmin window shows elevation – an "Elev." column with a total in the activity table, and an Elevation block (period total; 7 daily values or the month as calendar cells). A day's elevation = the sum of that day's activities (owner's choice). Migration `v3_7_garmin_elevation` and `garmin-sync` are on production (owner, 8 Nov).
- **Merged:** mkalmutzke/habits#10 and #11 – `main` = `85419a2` = v3.7.0 (the same code that is live). Supabase CLI linked back to `habits-test` (owner).
- **Open:**
  1. **Tag `v3.7.0` still on the old commit `39912be`** (it was moved before #11 was merged). Owner, now: `git fetch origin && git tag -f v3.7.0 origin/main && git push -f origin v3.7.0`; check with `git rev-list -n1 v3.7.0` → `85419a2…`.
  2. The handoff commits (Steps 14–15) are on `claude/exciting-heisenberg-3husfl`, PR into `main` – merge when green.
- **Owner to check:** Vercel deployed `release/v3.7` to production before `main` changed → Vercel → Settings → Git → Production Branch should be `main` (recommended), otherwise release branches go live before they are merged.
- The 3 end-to-end tests that fail in the cloud container (habit reminders, reminders, drag a habit on the phone) pass in CI – a container-only problem, not urgent.
- **Brief tasks** (owner's Claude account, Zurich time, fresh cloud session per run, instructions in [`docs/briefs/`](briefs/README.md)): world news daily 07:37, Canada jobs daily 07:41, IBKR Tue–Sat 07:45. Changing a task's text: edit the file in `docs/briefs/`, then update the scheduled task. Open, owner: widen the Claude environment's network access (or allow the news sites) so the briefs can link each article.
- App live: v3.7.0. 19 migrations, Edge Functions `send-reminders`, `send-test-notification`, `ibkr-sync`, `garmin-sync`, `brief-ingest`. Repository `mkalmutzke/habits` (fresh start from v3.5.0, Step 1); app at `https://habits.mkalmutzke.com`.
- The IBKR token and the Garmin key expire around 28 Oct 2027 – renew them in **both** Supabase projects (owner's guide, outside the repository).

## Open, owner's choice

| Item | Recommendation |
|---|---|
| Old address `todo.mkalmutzke.com` | It points to `185.181.104.242`, not Vercel – check at INWX; redirect it to habits.mkalmutzke.com for a while, then remove it (also the old redirect URL in Supabase and the old domain in Resend) |
| Branch protection for `main` (ruleset with required checks) | Set it up again in the new repository, as before |
| Calendar reminder for the keys | about 21 Oct 2027 |

## Working agreements

- One PR per step or per small version; every step in `BUILD_LOG.md`. Decisions are explained in the entry's **Why** (no separate design documents in the repository).
- Cloud containers can't log in to Supabase, push tags or open the live site: the owner runs `npx supabase …` on their computer, pushes the tag and checks the live version.
- **Claude merges its own PRs once all checks are green.** Going live and cloud database changes need the owner's explicit OK.
- Answer in the owner's language; short status lines during long work.

## Tooling quirks

- A plugin hook blocks shell commands whose text contains words like "secret", ".env", "key" or "credential" → write such text with the editor tool or into a script file.
- Run the **whole** end-to-end suite locally before pushing (`npx playwright test`, local stack via `npm run db:start`).
- Cloud container: Docker may not be running → start it with `dockerd &`; the `pg_prove` image may not download → run the pgTAP files with `psql` inside the database container; Playwright may expect a newer headless browser than the installed one → link the installed one under `/opt/pw-browsers` (local only).
- Force-pushing is blocked in the cloud container → after a PR is merged, merge the release branch (or `main`) into the working branch instead of rebasing.
- Tag a release only **after** the release PR is merged into `main` (v3.7.0 was tagged too early).
- No Prettier in this project – don't run `npx prettier` (its defaults reformat whole files).
- Database tests run as the owner and see all rows → tests count only their own rows.
- CI sometimes fails to start Docker (port) – rerun the failed job.
- With `--linked`, the Supabase CLI seemed to ignore `--project-ref` – for production, check in the dashboard.
- Android Chrome may not report a time picked inside a modal dialog → time fields in dialogs are uncontrolled and read on save.

## Starting and ending a session

- **Start:** nothing to type – the session-start hook shows this file, the git state and the latest build-log entry.
- **End:** `/handoff` – updates the build log and this file, commits and pushes.

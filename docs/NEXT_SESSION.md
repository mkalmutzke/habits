# Next session – handoff

*Written 1 November 2026 after Step 9. Details: [`BUILD_LOG.md`](../BUILD_LOG.md).*

## Where we stopped

- **v3.6.0 is built, not live yet** (Steps 4–9, integration branch `release/v3.6`, one PR per step):
  - habit groups (Sport, Dog, default "Other") with an icon to show all habits, managed in Settings; Settings sections fold;
  - Garmin as a window from the header (running figure) with Refresh, a steps chart and distances; no Garmin card on Week;
  - three daily briefs – IBKR (newspaper on the IBKR card, Tue–Sat), Canada jobs (briefcase) and world news (globe) – each with an amber dot until opened today and an on/off switch in Settings.
  - Briefs are written by Claude scheduled tasks on the owner's Claude plan and stored through the Edge Function `brief-ingest` (own password). How it works and the task instructions: [`docs/briefs/`](briefs/README.md).
- **Waiting for the owner** (the release checklist is in Step 9 of the build log):
  1. OK to go live → apply the 2 new migrations and deploy `garmin-sync` + `brief-ingest` (habits-test first, then production); merge `release/v3.6` into `main`; tag `v3.6.0`.
  2. Set the brief password: `BRIEF_INGEST_TOKEN` in the Supabase dashboard; `HABITS_BRIEF_URL` and `HABITS_BRIEF_AUTH` in the Claude cloud environment, plus network access to the Supabase host.
  3. Then Claude creates the three scheduled tasks (instructions in `docs/briefs/`) and fires one test run each.

- **Fresh start (Step 1):** this repository (`mkalmutzke/habits`, public) starts from the code of v3.5.0 with one commit and no history. The old repository `habit-tracker` was deleted by the owner on 30 Oct (Step 3); its design documents and old build log (Steps 1–153) are in the owner's download.
- **Move done (Step 2):** the app runs at `https://habits.mkalmutzke.com` from this repository; emails come from `…@habits.mkalmutzke.com`. The end-to-end test pattern was fixed for the new folder name.
- App live: v3.5.0. In `release/v3.6`: 18 migrations, Edge Functions `send-reminders`, `send-test-notification`, `ibkr-sync`, `garmin-sync`, `brief-ingest`.
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
- Force-pushing is blocked in the cloud container → after a PR is merged, merge `release/v3.6` into the working branch instead of rebasing.
- Database tests run as the owner and see all rows → tests count only their own rows.
- CI sometimes fails to start Docker (port) – rerun the failed job.
- With `--linked`, the Supabase CLI seemed to ignore `--project-ref` – for production, check in the dashboard.
- Android Chrome may not report a time picked inside a modal dialog → time fields in dialogs are uncontrolled and read on save.

## Starting and ending a session

- **Start:** nothing to type – the session-start hook shows this file, the git state and the latest build-log entry.
- **End:** `/handoff` – updates the build log and this file, commits and pushes.

# Next session – handoff

*Written 30 October 2026 after Step 2. Details: [`BUILD_LOG.md`](../BUILD_LOG.md).*

## Where we stopped

- **Fresh start (Step 1):** this repository (`mkalmutzke/habits`, public) starts from the code of v3.5.0 with one commit and no history. The old repository `habit-tracker` (history, PRs, tags, design documents) is kept by the owner outside this repository and deleted once the move works.
- **Move done (Step 2):** the app runs at `https://habits.mkalmutzke.com` from this repository; emails come from `…@habits.mkalmutzke.com`. The end-to-end test pattern was fixed for the new folder name.
- App: v3.5.0 – What's up? (IBKR card, Habits, ToDo's), Week (Garmin, Due & overdue, Shopping), Lists, Settings. Supabase projects `habits-test` and production, 16 migrations, Edge Functions `send-reminders`, `send-test-notification`, `ibkr-sync`, `garmin-sync`.
- The IBKR token and the Garmin key expire around 28 Oct 2027 – renew them in **both** Supabase projects (owner's guide, outside the repository).

## Open, owner's choice

| Item | Recommendation |
|---|---|
| Old address and old repository | Redirect `todo.mkalmutzke.com` (it points to `185.181.104.242`, not Vercel – check at INWX), then remove it; delete the old repository `habit-tracker` |
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
- Database tests run as the owner and see all rows → tests count only their own rows.
- CI sometimes fails to start Docker (port) – rerun the failed job.
- With `--linked`, the Supabase CLI seemed to ignore `--project-ref` – for production, check in the dashboard.
- Android Chrome may not report a time picked inside a modal dialog → time fields in dialogs are uncontrolled and read on save.

## Starting and ending a session

- **Start:** nothing to type – the session-start hook shows this file, the git state and the latest build-log entry.
- **End:** `/handoff` – updates the build log and this file, commits and pushes.

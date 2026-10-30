# Habit Tracker – Project Instructions

## Project
- Personal habit tracker web app (React + Vite), built step by step following the ClaudeWorld "first app" tutorial.
- Hosted in a GitHub repository; deployed to Vercel later.
- The owner is learning, so clarity and traceability matter more than speed.

## Build log – MANDATORY
Every action you execute must be documented in `BUILD_LOG.md` in the project root, so the build can be followed and reproduced later as a guide.

Rules:
1. Create `BUILD_LOG.md` if it doesn't exist yet.
2. Append an entry **after each step you complete** — never batch several steps into one entry at the end.
3. Log every executed command, every file created/changed/deleted, and every package installed or removed.
4. Never rewrite or delete earlier entries. If something was undone or fixed, add a new entry that says so.
5. Use this format for each entry:

```markdown
### Step <number> – <short title>
**Date:** YYYY-MM-DD HH:MM
**Request:** <what the user asked, in one sentence>
**Why:** <the reason for this step, in plain language>

**Commands run:**
```bash
<exact commands, in order>
```

**Files changed:**
- `path/to/file` – created / modified / deleted: <what and why>

**Result:** <what works now / what the user should see>
**Issues & fixes:** <errors hit and how they were solved, or "None">
**Commit:** <commit hash and message, if committed>
```

6. Write explanations for a beginner: no unexplained jargon.
7. Keep this `CLAUDE.md` short — the step-by-step history belongs in `BUILD_LOG.md`, not here.

## Git workflow
- `.gitignore` must include `node_modules`, `dist`, and `.env`.
- Commit and push to GitHub at each tutorial checkpoint, and after any larger change.
- Use clear commit messages, e.g. `feat: add streak counter`, `style: soften background gradient`.
- Commit the updated `BUILD_LOG.md` together with the code changes it describes.
- Never commit secrets or API keys.
- Larger work: one PR per step into an integration branch (e.g. `release/v4`); merge only when all checks are green; never delete the integration branch before the release.
- Keys and tokens never go into chat, code, logs or tests – not even made-up key-like strings (gitleaks flags them). The owner enters real keys in the dashboards.
- Before any `supabase db`/`functions`/`secrets` command, check which project the CLI is linked to (`supabase/.temp/project-ref`); it must be `habits-test` except during a release.

## Working style
- Before running anything that installs packages or deletes files, say what you are about to do.
- After each step, tell the user how to see the result (e.g. which URL to open).

## Sessions
- At session start the hook `.claude/hooks/session-context.sh` shows the git state, `docs/NEXT_SESSION.md` and the latest build-log entry. If it is missing, read `docs/NEXT_SESSION.md` before starting work.
- At the end of a session (or when the owner says "wrap up"), run the `handoff` skill (`/handoff`).

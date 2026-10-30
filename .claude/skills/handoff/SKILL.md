---
name: handoff
description: End-of-session handoff. Use when the user types /handoff or says "wrap up", "end the session", "save the state" or "hand over" – writes the session's state back into the repository (BUILD_LOG, NEXT_SESSION), commits and pushes, so the next session (VS Code, terminal or web) can continue.
---

# Handoff – save the session's state in the repository

The next session starts with `.claude/hooks/session-context.sh`, which shows
`docs/NEXT_SESSION.md` and the latest `BUILD_LOG.md` entry. Everything the next
session needs must therefore be in those files – not only in this conversation.
Work through the steps in order and report each in one short line.

## 1. Take stock
- `git status -sb`, `git log --oneline origin/main..HEAD`, open PRs (`gh pr list` or the GitHub tools).
- List what this session did: steps, files, commands, decisions, things left half-done.

## 2. Build log (`BUILD_LOG.md`)
- Every step of this session has its own entry in the format of `CLAUDE.md` (never batch, never rewrite old entries).
- Add any that are missing now – with the real commands and results, nothing invented.
- The last entry is this handoff ("Step N – Session handoff"), short.

## 3. `docs/NEXT_SESSION.md`
Rewrite the top section "Where we stopped" so it is true *now*:
- the live version and what is merged / open (PRs, branches);
- anything half-done, with the exact next step and command;
- decisions the owner still has to make (with a recommendation);
- new working agreements and tooling quirks learned in this session (keep the lists short; drop what is obsolete).
Update the "Written … after Step N" line.

## 4. Check, commit, push
- If code changed and was not committed yet: run the `verify` skill first.
- Commit message: `docs: session handoff (Step N)` (or include it in the step's own commit).
- On `main`: never commit directly – create a branch (`docs/handoff-YYYY-MM-DD`) and open a PR; merge only when all checks are green (working agreement).
- On a feature branch: commit and push to it (`git push -u origin <branch>`).
- Never commit secrets, `.env` files or local-only files.

## 5. Final message to the owner
Three lines at most:
- where the work stands (one line);
- what the next session should start with;
- anything the owner must do by hand (e.g. a cloud database change, a phone test).

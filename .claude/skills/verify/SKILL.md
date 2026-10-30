---
name: verify
description: Pre-commit quality gate. Run before every commit, or when the user asks to check, verify or review the current changes.
---

# Pre-commit verification

Run these checks on the uncommitted changes, in order. Stop and report at the first failure; fix it (or ask the user) before committing.

## Current changes

!`git status --short`

!`git diff HEAD --stat`

## 1. Automated checks
Run whichever of these scripts exist in `package.json` (skip missing ones and say so):
- `npm run lint`
- `npm run typecheck` (or `npx tsc --noEmit` if TypeScript is used)
- `npm test -- --run`
- `npm run build`

## 2. Review the diff
Read `git diff HEAD` and check:
- **Correctness:** logic errors, unhandled edge cases (empty list, first day, missed day, midnight, week boundaries).
- **Architecture:** follows the `architecture-guide` skill (no direct `localStorage` in components, dates via the date utility, logic outside components).
- **Security:** no secrets, API keys or `.env` content; no `dangerouslySetInnerHTML` with user input.
- **Leftovers:** no `console.log`, commented-out code, or unexplained TODOs.
- **Tests:** changed logic has matching tests.
- **Build log:** `BUILD_LOG.md` has an entry describing these changes.

## 3. Report
Give a short verdict:
- ✅ **Ready to commit** — with a suggested commit message, or
- ❌ **Needs fixes** — a numbered list of issues, most important first.

Never commit or push yourself as part of this skill; the commit happens after the verdict.

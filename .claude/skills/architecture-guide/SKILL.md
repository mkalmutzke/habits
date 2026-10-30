---
name: architecture-guide
description: Architecture rules for this app. Use when adding a feature, creating files or folders, choosing a library, changing how data is stored, or making any structural decision.
---

# Architecture guide

Follow these rules for every structural change. If a rule blocks something the user wants, say so and propose an alternative instead of silently breaking it.

## Before larger changes
- For a new feature or any change touching more than ~3 files: first propose a short plan (affected files, data model changes, new dependencies, trade-offs) and wait for approval.
- Record each significant decision in the **Why** of its `BUILD_LOG.md` entry (what was decided, the alternatives, the consequences — a few lines). Architecture documents are kept by the owner outside the repository.

## Structure
- Organize by feature: `src/features/<feature>/` holds that feature's components, hooks and logic.
- Shared, reusable pieces go in `src/shared/` (UI components, utilities).
- Keep components small and focused (aim for under ~150 lines); extract when they grow.

## Logic and data
- Business logic (streaks, completion rules, week calculations) lives in plain functions with no React imports, so it can be unit-tested.
- All date handling goes through one date utility module using the local time zone. Never call `toISOString()` to decide which day something belongs to.
- **Storage behind an interface:** components and hooks never touch `localStorage` directly. They call a storage module in `src/storage/` (e.g. `loadHabits`, `saveHabits`). This lets the app move to a real backend/database later by replacing one module.
- Stored data carries a schema version. Any format change includes a migration from the previous version.

## Code quality
- If the project uses TypeScript, keep `strict` on and avoid `any`.
- Every new dependency needs a one-line justification in the build log; prefer small, well-maintained packages and check whether the platform already does the job.
- Pure logic gets unit tests; changes to logic update or add tests.

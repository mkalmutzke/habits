#!/usr/bin/env bash
# Session start (Claude Code "SessionStart" hook, .claude/settings.json):
# prints where the project stands. Claude Code adds this output to Claude's
# context, so every new session – VS Code, terminal or web – knows the state
# without being asked. Read-only: it never changes files or branches.

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

echo "=== Project state at session start (.claude/hooks/session-context.sh) ==="
echo "Read this before starting work. At the end of the session run /handoff."
echo

echo "## Git"
# compare with GitHub; skipped quietly when offline (never blocks the start)
if command -v timeout >/dev/null 2>&1; then
  timeout 8 git fetch --quiet --prune origin 2>/dev/null || echo "(could not reach GitHub – state below may be out of date)"
fi
git status -sb 2>/dev/null | head -8
echo "Last commits:"
git log --oneline -3 2>/dev/null
echo

if [ -f docs/NEXT_SESSION.md ]; then
  echo "## docs/NEXT_SESSION.md"
  cat docs/NEXT_SESSION.md
  echo
fi

if [ -f BUILD_LOG.md ]; then
  echo "## Latest BUILD_LOG.md entry"
  # from the last "### Step" heading to the end of the file
  awk '/^### Step /{entry=""} {entry = entry $0 "\n"} END{printf "%s", entry}' BUILD_LOG.md
fi

exit 0

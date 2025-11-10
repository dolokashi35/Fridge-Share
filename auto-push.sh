#!/usr/bin/env bash
set -euo pipefail

# Auto-commit and push all changes on the current branch every 30 seconds.
# Usage: bash ./auto-push.sh

INTERVAL="${INTERVAL_SECONDS:-30}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "Auto-pushing changes on branch '${BRANCH}' every ${INTERVAL}s. Press Ctrl+C to stop."

while true; do
  # Detect changes
  if [[ -n "$(git status --porcelain=v1)" ]]; then
    TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    git add -A || true
    git commit -m "autopush: ${TS}" || true
    # Rebase and push to minimize rejects
    git pull --rebase origin "${BRANCH}" || true
    git push origin "${BRANCH}" || true
    echo "[${TS}] changes pushed."
  fi
  sleep "${INTERVAL}"
done



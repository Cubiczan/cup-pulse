#!/usr/bin/env bash
# Push cup-pulse to Cubiczan personal GitHub (mirror).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GIT_DIR="${GIT_DIR:-$ROOT/.git-worktree}"
export GIT_WORK_TREE="$ROOT"

if [[ -z "${CUBICZAN_TOKEN:-}" ]]; then
  echo "Use your Cubiczan personal PAT:"
  echo "  export CUBICZAN_TOKEN='ghp_...'"
  exit 1
fi

CUBICZAN_USER="${CUBICZAN_USER:-Cubiczan}"
CUBICZAN_REPO="${CUBICZAN_REPO:-cup-pulse}"

echo "Target: https://github.com/${CUBICZAN_USER}/${CUBICZAN_REPO}"

REPO_JSON=$(curl -sS -H "Authorization: Bearer ${CUBICZAN_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${CUBICZAN_USER}/${CUBICZAN_REPO}")

REPO_OK=$(echo "$REPO_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('id') else 'no')" 2>/dev/null)

if [[ "$REPO_OK" != "yes" ]]; then
  echo "Creating repo..."
  CREATE=$(curl -sS -X POST -H "Authorization: Bearer ${CUBICZAN_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/user/repos" \
    -d "{\"name\":\"${CUBICZAN_REPO}\",\"description\":\"Cup Pulse — P2P fan war room on the Pears Stack\",\"private\":false,\"auto_init\":false}")
  echo "$CREATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html_url') or d.get('message'))"
fi

REMOTE="https://x-access-token:${CUBICZAN_TOKEN}@github.com/${CUBICZAN_USER}/${CUBICZAN_REPO}.git"
git remote remove cubiczan 2>/dev/null || true
git remote add cubiczan "$REMOTE"
git push -u cubiczan main
git remote set-url cubiczan "https://github.com/${CUBICZAN_USER}/${CUBICZAN_REPO}.git"

echo ""
echo "Success: https://github.com/${CUBICZAN_USER}/${CUBICZAN_REPO}"

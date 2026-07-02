#!/usr/bin/env bash
# Publish cup-pulse to GitHub (default: icohangar-ops/cup-pulse).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GIT_DIR="${GIT_DIR:-$ROOT/.git-worktree}"
export GIT_DIR
export GIT_WORK_TREE="$ROOT"

if [[ ! -d "$GIT_DIR" ]]; then
  echo "Missing $GIT_DIR — run from cup-pulse-pear project."
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "export GITHUB_TOKEN='ghp_...'"
  exit 1
fi

GITHUB_OWNER="${GITHUB_OWNER:-icohangar-ops}"
GITHUB_REPO="${GITHUB_REPO:-cup-pulse}"
GITHUB_REPO_URL="${GITHUB_REPO_URL:-https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}}"

echo "Target: ${GITHUB_REPO_URL}"

USER_JSON=$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" https://api.github.com/user)
GITHUB_LOGIN=$(echo "$USER_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('login',''))" 2>/dev/null || true)

if [[ -z "$GITHUB_LOGIN" ]]; then
  echo "Bad token:"
  echo "$USER_JSON"
  exit 1
fi
echo "Token user: $GITHUB_LOGIN"

REPO_JSON=$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}")

REPO_OK=$(echo "$REPO_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('id') else 'no')" 2>/dev/null)

if [[ "$REPO_OK" != "yes" ]]; then
  echo "Repo not found — creating ${GITHUB_OWNER}/${GITHUB_REPO}..."

  if [[ "$GITHUB_LOGIN" == "$GITHUB_OWNER" ]]; then
  CREATE_URL="https://api.github.com/user/repos"
  else
  CREATE_URL="https://api.github.com/orgs/${GITHUB_OWNER}/repos"
  fi

  CREATE_JSON=$(curl -sS -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "$CREATE_URL" \
    -d "{\"name\":\"${GITHUB_REPO}\",\"description\":\"Cup Pulse — P2P fan war room on the Pears Stack\",\"private\":false,\"auto_init\":false}")

  CREATE_OK=$(echo "$CREATE_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('id') else 'no')" 2>/dev/null)

  if [[ "$CREATE_OK" != "yes" ]]; then
    echo "Create failed:"
    echo "$CREATE_JSON" | python3 -m json.tool 2>/dev/null || echo "$CREATE_JSON"
    echo ""
    echo "Create an empty repo manually at:"
    echo "  https://github.com/organizations/${GITHUB_OWNER}/repositories/new"
    echo "Name: ${GITHUB_REPO}  (no README, no .gitignore)"
    exit 1
  fi
  echo "Created repo."
fi

PUSH_REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git"
git remote remove origin 2>/dev/null || true
git remote add origin "$PUSH_REMOTE"

echo "Pushing main..."
if ! git push -u origin main; then
  echo ""
  echo "Push failed. If remote has a README commit, run once:"
  echo "  git pull origin main --rebase --allow-unrelated-histories"
  echo "  git push -u origin main"
  exit 1
fi

git remote set-url origin "${GITHUB_REPO_URL}.git"

echo ""
echo "Success: ${GITHUB_REPO_URL}"
echo "Video: ${GITHUB_REPO_URL}/blob/main/demo/cup-pulse-demo.mp4"

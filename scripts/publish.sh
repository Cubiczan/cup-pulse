#!/usr/bin/env bash
# Publish cup-pulse-pear to GitHub and optionally Codeberg.
#
# Usage (org repo):
#   export GITHUB_TOKEN='ghp_...'
#   export GITHUB_OWNER='Icohangar-ops'   # or Cubiczan
#   export GITHUB_REPO='cup-pulse-pear'
#   bash scripts/publish.sh
#
# Or paste the repo URL GitHub gave you when you created it:
#   export GITHUB_REPO_URL='https://github.com/Cubiczan/cup-pulse-pear.git'
#   export GITHUB_TOKEN='ghp_...'
#   bash scripts/publish.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GIT_DIR="${GIT_DIR:-$ROOT/.git-worktree}"
export GIT_DIR
export GIT_WORK_TREE="$ROOT"

if [[ ! -d "$GIT_DIR" ]]; then
  echo "Git not initialized at $GIT_DIR"
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Set GITHUB_TOKEN (PAT with repo scope)."
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${GITHUB_TOKEN}"

# Resolve owner/repo from URL or env
if [[ -n "${GITHUB_REPO_URL:-}" ]]; then
  # https://github.com/OWNER/REPO.git
  GITHUB_REPO_URL="${GITHUB_REPO_URL%.git}"
  OWNER_REPO="${GITHUB_REPO_URL#https://github.com/}"
  GITHUB_OWNER="${OWNER_REPO%%/*}"
  GITHUB_REPO="${OWNER_REPO##*/}"
else
GITHUB_OWNER="${GITHUB_OWNER:-${GITHUB_ORG:-Icohangar-ops}}"
GITHUB_REPO="${GITHUB_REPO:-cup-pulse}"
  GITHUB_REPO_URL="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}"
fi

echo "Target: ${GITHUB_REPO_URL}"
echo "Checking token..."

USER_JSON=$(curl -sS -H "$AUTH_HEADER" -H "Accept: application/vnd.github+json" https://api.github.com/user)
GITHUB_USER=$(echo "$USER_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('login',''))" 2>/dev/null || true)

if [[ -z "$GITHUB_USER" ]]; then
  echo "Token invalid or API error:"
  echo "$USER_JSON" | head -c 500
  exit 1
fi
echo "Authenticated as: $GITHUB_USER"

REPO_JSON=$(curl -sS -H "$AUTH_HEADER" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}")

REPO_EXISTS=$(echo "$REPO_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('full_name') else 'no')" 2>/dev/null || echo "no")

if [[ "$REPO_EXISTS" != "yes" ]]; then
  MSG=$(echo "$REPO_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null || true)
  echo ""
  echo "Repo not found or no access: ${GITHUB_OWNER}/${GITHUB_REPO}"
  echo "GitHub says: ${MSG:-unknown}"
  echo ""
  echo "Fix one of these:"
  echo "  1. Create the repo on GitHub first (empty, no README)."
  echo "  2. If you created it under your user account, run:"
  echo "       export GITHUB_OWNER='${GITHUB_USER}'"
  echo "       export GITHUB_REPO='cup-pulse-pear'"
  echo "  3. Or set the exact URL:"
  echo "       export GITHUB_REPO_URL='https://github.com/YOUR_USER/cup-pulse-pear.git'"
  echo "  4. For org repos, ensure the PAT has access to org '${GITHUB_OWNER}'"
  echo "     (Settings → org → Personal access tokens → approve token)."
  exit 1
fi

echo "Repo exists: ${GITHUB_OWNER}/${GITHUB_REPO}"

PUSH_REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git"
git remote remove origin 2>/dev/null || true
git remote add origin "$PUSH_REMOTE"

echo "Pushing main..."
git push -u origin main

# Store remote without token embedded (for future pulls)
git remote set-url origin "${GITHUB_REPO_URL}.git"

echo ""
echo "Success: ${GITHUB_REPO_URL}"

if [[ -n "${CODEBERG_TOKEN:-}" ]]; then
  CODEBERG_USER="${CODEBERG_USER:-Cubiczan}"
  CODEBERG_REPO="${CODEBERG_REPO:-cup-pulse-pear}"
  CODEBERG_REMOTE="https://${CODEBERG_USER}:${CODEBERG_TOKEN}@codeberg.org/${CODEBERG_USER}/${CODEBERG_REPO}.git"
  echo "Pushing to Codeberg..."
  git remote remove codeberg 2>/dev/null || true
  git remote add codeberg "$CODEBERG_REMOTE"
  git push -u codeberg main || echo "Codeberg push failed — create empty repo on Codeberg first"
  echo "Codeberg: https://codeberg.org/${CODEBERG_USER}/${CODEBERG_REPO}"
fi

echo ""
echo "BUIDL: https://dorahacks.io/hackathon/tether-developers-cup/detail"
echo "Video: ${GITHUB_REPO_URL}/blob/main/demo/cup-pulse-demo.mp4"

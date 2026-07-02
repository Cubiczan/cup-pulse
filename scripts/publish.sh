#!/usr/bin/env bash
# Publish cup-pulse-pear to GitHub (Icohangar-ops) and optionally Codeberg.
# Usage:
#   export GITHUB_TOKEN='ghp_...'          # Icohangar-ops or org admin token
#   export CODEBERG_TOKEN='...'            # optional
#   bash scripts/publish.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GIT_DIR="${GIT_DIR:-$ROOT/.git-worktree}"
export GIT_DIR
export GIT_WORK_TREE="$ROOT"

if [[ ! -d "$GIT_DIR" ]]; then
  echo "Git not initialized. Run:"
  echo "  git init -b main"
  echo "  git add -A && git commit -m 'Initial commit'"
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Set GITHUB_TOKEN (PAT with repo scope for Icohangar-ops)."
  exit 1
fi

GITHUB_ORG="${GITHUB_ORG:-Icohangar-ops}"
GITHUB_REPO="${GITHUB_REPO:-cup-pulse-pear}"
GITHUB_REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_ORG}/${GITHUB_REPO}.git"

echo "Creating GitHub repo ${GITHUB_ORG}/${GITHUB_REPO} if missing..."
curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_REPO}" >/dev/null 2>&1 || \
curl -sS -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/orgs/${GITHUB_ORG}/repos" \
  -d "{\"name\":\"${GITHUB_REPO}\",\"description\":\"Cup Pulse — P2P fan war room on the Pears Stack\",\"private\":false}" >/dev/null

git remote remove origin 2>/dev/null || true
git remote add origin "$GITHUB_REMOTE"
git push -u origin main

echo ""
echo "GitHub: https://github.com/${GITHUB_ORG}/${GITHUB_REPO}"

if [[ -n "${CODEBERG_TOKEN:-}" ]]; then
  CODEBERG_USER="${CODEBERG_USER:-Cubiczan}"
  CODEBERG_REPO="${CODEBERG_REPO:-cup-pulse-pear}"
  CODEBERG_REMOTE="https://${CODEBERG_USER}:${CODEBERG_TOKEN}@codeberg.org/${CODEBERG_USER}/${CODEBERG_REPO}.git"
  echo "Pushing to Codeberg ${CODEBERG_USER}/${CODEBERG_REPO}..."
  git remote remove codeberg 2>/dev/null || true
  git remote add codeberg "$CODEBERG_REMOTE"
  git push -u codeberg main || echo "Codeberg push failed — create repo at codeberg.org first"
  echo "Codeberg: https://codeberg.org/${CODEBERG_USER}/${CODEBERG_REPO}"
fi

echo ""
echo "Done. Submit BUIDL: https://dorahacks.io/hackathon/tether-developers-cup/detail"

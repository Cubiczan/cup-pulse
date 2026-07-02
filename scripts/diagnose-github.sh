#!/usr/bin/env bash
# Diagnose GitHub push issues for cup-pulse.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GIT_DIR="${GIT_DIR:-$ROOT/.git-worktree}"
export GIT_WORK_TREE="$ROOT"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "export GITHUB_TOKEN='ghp_...'"
  exit 1
fi

OWNER="${1:-icohangar-ops}"
REPO="${2:-cup-pulse}"

echo "=== Token ==="
curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('login:', d.get('login'))
print('type:', d.get('type'))
print('message:', d.get('message',''))
"

echo ""
echo "=== Repo icohangar-ops/cup-pulse ==="
curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/icohangar-ops/cup-pulse" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('full_name:', d.get('full_name'))
print('private:', d.get('private'))
print('message:', d.get('message',''))
"

echo ""
echo "=== Repo Icohangar-ops/cup-pulse ==="
curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/Icohangar-ops/cup-pulse" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('full_name:', d.get('full_name'))
print('message:', d.get('message',''))
"

echo ""
echo "=== Repos visible to this token (first 10) ==="
curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/user/repos?per_page=10&sort=updated" | python3 -c "
import json,sys
repos=json.load(sys.stdin)
if isinstance(repos,dict):
  print('error:', repos.get('message'))
else:
  for r in repos:
    print(r.get('full_name'), 'private='+str(r.get('private')))
"

echo ""
echo "=== Local git ==="
git remote -v 2>/dev/null || echo "no remotes"
git branch -v
git log -1 --oneline

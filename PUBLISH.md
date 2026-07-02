# Publish Cup Pulse

Git data lives in `.git-worktree/` (workaround for this environment). Commits are ready to push.

## 1. Rotate your tokens first

You pasted PATs in chat. **Revoke them now** and create new ones:

- GitHub → Settings → Developer settings → Personal access tokens  
- Codeberg → Settings → Applications → Access tokens  

## 2. Push to GitHub (Icohangar-ops)

```bash
cd /Users/cubiczan/Projects/cup-pulse-pear

export GITHUB_TOKEN='YOUR_NEW_ICOHANGAR_OPS_OR_GITHUB_PAT'
export GITHUB_ORG='Icohangar-ops'
export GITHUB_REPO='cup-pulse-pear'

bash scripts/publish.sh
```

Repo URL will be: **https://github.com/Icohangar-ops/cup-pulse-pear**

## 3. Optional: push to Codeberg

```bash
export CODEBERG_TOKEN='YOUR_NEW_CODEBERG_PAT'
export CODEBERG_USER='Cubiczan'
bash scripts/publish.sh
```

## 4. Normal git commands (this repo)

```bash
export GIT_DIR=/Users/cubiczan/Projects/cup-pulse-pear/.git-worktree
export GIT_WORK_TREE=/Users/cubiczan/Projects/cup-pulse-pear
git status
```

Or link for standard git:

```bash
cd /Users/cubiczan/Projects/cup-pulse-pear
ln -sf .git-worktree .git
```

## 5. DoraHacks BUIDL

After push, submit at: https://dorahacks.io/hackathon/tether-developers-cup/detail

- **Repo:** `https://github.com/Icohangar-ops/cup-pulse-pear`  
- **Video:** `https://github.com/Icohangar-ops/cup-pulse-pear/blob/main/demo/cup-pulse-demo.mp4`  
- **Track:** Pears : Peer to Peer  

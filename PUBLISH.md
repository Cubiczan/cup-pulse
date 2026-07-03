# Publish Cup Pulse

Git data lives in `.git-worktree/` (workaround for this environment). Commits are ready to push.

## 1. Rotate your tokens first

You pasted PATs in chat. **Revoke them now** and create new ones:

- GitHub → Settings → Developer settings → Personal access tokens
- Codeberg → Settings → Applications → Access tokens

## 2. Push to GitHub

**Use the exact owner from the repo URL GitHub showed when you created it.**

### If repo is under your user (e.g. `Cubiczan/cup-pulse-pear`)

```bash
cd /Users/cubiczan/Projects/cup-pulse-pear
export GIT_DIR="$PWD/.git-worktree"
export GIT_WORK_TREE="$PWD"

export GITHUB_TOKEN='YOUR_NEW_PAT'
export GITHUB_REPO_URL='https://github.com/Icohangar-ops/cup-pulse.git'

bash scripts/publish.sh
```

### If repo is under the org (`Icohangar-ops/cup-pulse`)

```bash
export GITHUB_TOKEN='YOUR_NEW_PAT'
export GITHUB_OWNER='Icohangar-ops'
export GITHUB_REPO='cup-pulse'
bash scripts/publish.sh
```

> Org push requires the PAT to be **authorized for Icohangar-ops**:  
> GitHub → **Icohangar-ops** → Settings → **Third-party access** / **Personal access tokens** → approve your token.

### Manual push (if script still fails)

```bash
cd /Users/cubiczan/Projects/cup-pulse-pear
export GIT_DIR="$PWD/.git-worktree"
export GIT_WORK_TREE="$PWD"

git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/Icohangar-ops/cup-pulse.git
git push -u origin main
```

(GitHub will prompt for username + PAT as password.)

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

- **Repo:** `https://github.com/Icohangar-ops/cup-pulse`
- **Video:** `https://github.com/Icohangar-ops/cup-pulse/blob/main/demo/cup-pulse-demo.mp4`
- **Track:** Pears : Peer to Peer

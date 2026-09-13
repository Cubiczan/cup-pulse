# Cup Pulse

**P2P fan war room for tournament predictions, watch-parties, and community pledge pipelines — no server in the middle.**

[![Tether Developers Cup](https://img.shields.io/badge/Hackathon-Tether%20Developers%20Cup-21c437)](https://dorahacks.io/hackathon/tether-developers-cup/detail)
[![Track](https://img.shields.io/badge/Track-Pears%20Peer--to--Peer-0e4f15)](https://dorahacks.io/hackathon/tether-developers-cup/tracks)
[![Tests](https://img.shields.io/badge/tests-41%20passing-brightgreen)](#verification)

> **BUIDL submission** for [Tether Developers Cup](https://dorahacks.io/hackathon/tether-developers-cup/detail) · **Pears : Peer to Peer** track  
> **Theme:** Football / global tournament — fans, teams, matches, predictions, watch-parties, communities

---

## Elevator pitch

During a global football tournament, fan groups need to coordinate **match predictions**, **watch-party logistics**, and **community pledge pools** without handing data to a central platform. **Cup Pulse** is a peer-to-peer fan war room built on the **Pears Stack**: organizers spin up a Pear app, peers discover each other via **Hyperswarm**, and shared state replicates over **Hypercore** — **no traditional client-server API** for sync.

We reuse **deterministic pipeline scoring** (ported from sales-ops CRM logic) so every “at-risk” prediction is **explainable**: stale activity, missing next step, low contact coverage, close-date pressure, and fan-club health.

---

## Demo

| Asset                  | Link                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Demo video (3 min)** | [demo/cup-pulse-demo.mp4](./demo/cup-pulse-demo.mp4)                                      |
| **Live P2P demo**      | Run two instances — see [Quick start](#quick-start)                                       |
| **DoraHacks BUIDL**    | [Submit / view on DoraHacks](https://dorahacks.io/hackathon/tether-developers-cup/detail) |

**What the demo shows**

1. Cup Pulse dashboard — open pledges, weighted confidence, critical predictions
2. Organizer filters across metrics, predictions, and fan clubs
3. Two peers on the Pears Stack — add prediction in one window, sync to the other
4. Explainable risk labels and forecast buckets (`Commit`, `Best Case`, `Pipeline`, `At Risk`)

## PRISMtrace

Set `PRISMTRACE_API_KEY` and `PRISMTRACE_PROJECT_ID` to export Electron and peer-sync traces to BlockConvey.

---

## Problem

Fan communities during a global tournament rely on **fragmented tools** — group chats, spreadsheets, and centralized apps — to track:

- Match predictions and confidence pools
- Watch-party tasks and overdue follow-ups
- Per-organizer “books” of fan clubs and pledge drives

Data is **siloed**, **not portable**, and often **not explainable** when a group is flagged as disengaged.

## Solution

**Cup Pulse** applies a **pipeline-review UX** (familiar to sales ops) to **fan communities**:

| Sales CRM concept | Cup Pulse concept                                |
| ----------------- | ------------------------------------------------ |
| Account           | Fan club / watch-party group                     |
| Opportunity       | Match prediction or pledge drive                 |
| Stage             | Tournament round (Group → R16 → QF → SF → Final) |
| Owner             | Community organizer                              |
| Risk score        | Stale group, missing next step, low coverage     |
| Forecast          | Commit / Best Case / Pipeline / At Risk          |

All **sync** runs on the **Pears Stack** in a **Bare worker** — not through FastAPI, REST, or a hosted database.

---

## Features

- **P2P state sync** — Hyperswarm discovery + Hypercore append-only log + Corestore
- **Explainable risk scoring** — deterministic 0–100 score with documented weights
- **Forecast categories** — `Commit`, `Best Case`, `Pipeline`, `At Risk`
- **Organizer filters** — consistent metrics across predictions, clubs, and tasks
- **Tournament seed data** — football-themed fixtures (QF upsets, semi-final calls, tipping pools)
- **Unit tests** — 41 tests on scoring, forecasts, filters, summaries, and the media opt-in
- **AGENTS.md** — agent ops manual + [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) integration

---

## Optional: watch-party audio (off by default)

The README promises watch-parties, and Cup Pulse delivers the coordination —
who's hosting, who's pledged, whose prediction is at risk — all peer-to-peer.
What it cannot deliver peer-to-peer is people _talking_ while the match is on: a
full audio mesh falls over around six participants, which is smaller than a real
watch-party. Scaling past that needs an SFU, and an SFU is a server in the
middle.

So hosted audio exists as an explicit opt-in, **off by default and absent from
the Pears track submission**:

```bash
export CUP_PULSE_MEDIA=on
export AGORA_APP_ID=<your Agora app id>
export AGORA_APP_CERTIFICATE=<only on the organizer machine>
npm start
```

What does _not_ change when you enable it: predictions, pledges, tasks, and peer
discovery stay on Hypercore and Hyperswarm, and there is still no Cup Pulse
server anywhere. Only the audio is relayed. `assertStateStaysP2P()` enforces
that boundary in code, and the test suite covers the off-by-default behaviour so
you can verify the claim instead of trusting it.

Tokens need a secret, and there is no server to keep one on — so **the organizer
is the issuer**. This PR ships mint IPC and the join helper. Hypercore grant
distribution and the UI toggle are not wired yet; see
[docs/watch-party-media.md](docs/watch-party-media.md).

---

## Pears Stack alignment (judging criteria)

| Criterion                       | How Cup Pulse delivers                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| **Real use of Pears**           | `pear-runtime`, Bare worker, Hyperswarm room, Hypercore state log, Corestore persistence |
| **No client-server networking** | Sync path is P2P only; no central API for replication                                    |
| **Football / tournament theme** | Predictions, fan clubs, watch-party tasks, global-cup match names                        |
| **Technical ambition**          | Electron UI + embedded Bare worker + multi-peer Hypercore                                |
| **UX**                          | Pipeline dashboard with risk pills, metrics, organizer filter                            |
| **Creativity**                  | CRM pipeline metaphors for fan communities during a tournament moment                    |

**Building blocks used:** [Pear runtime](https://docs.pears.com/reference/pear/runtime/), [Hyperswarm](https://github.com/holepunchto/hyperswarm), [Hypercore](https://github.com/holepunchto/hypercore), [Corestore](https://github.com/holepunchto/corestore), [hello-pear-electron](https://github.com/holepunchto/hello-pear-electron) scaffold.

> **On "no client-server networking":** run Cup Pulse with no environment
> variables set and that row holds without qualification — that is the
> submission. The optional watch-party audio layer described above is off in
> that configuration, and even when enabled it relays audio only; the sync path
> is never anything but P2P.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Electron renderer (renderer/)                               │
│  Dashboard UI · metrics · organizer filter · add prediction   │
└───────────────────────────┬─────────────────────────────────┘
                            │ IPC (preload bridge)
┌───────────────────────────▼─────────────────────────────────┐
│  Electron main (electron/main.js)                            │
│  PearRuntime · spawns Bare worker                            │
└───────────────────────────┬─────────────────────────────────┘
                            │ FramedStream IPC
┌───────────────────────────▼─────────────────────────────────┐
│  Bare worker (workers/main.js)                               │
│  Hyperswarm topic · Hypercore state · Corestore              │
└───────────────────────────┬─────────────────────────────────┘
                            │ P2P
                     Remote peer (same app)
```

```text
cup-pulse-pear/
├── AGENTS.md              # AI agent operating manual
├── demo/
│   └── cup-pulse-demo.mp4 # 3-minute submission video
├── electron/              # Main process + preload IPC bridge
├── workers/               # Bare P2P sync worker
├── renderer/              # Dashboard UI
├── shared/
│   ├── cup.mjs            # Scoring & pipeline logic
│   └── seed.json          # Tournament-themed fixture data
└── test/
    └── cup.test.mjs       # Unit tests (node --test)
```

### Scoring logic (`shared/cup.mjs`)

- `scoreDealRisk` — stale activity, missing next step, contact coverage, close-date pressure, size, club health
- `riskLabel` — `Low` · `Medium` · `High` · `Critical`
- `forecastCategory` — `Commit` · `Best Case` · `Pipeline` · `At Risk`
- `summarizePipeline` — open pledges, weighted confidence, critical count, overdue tasks

---

## Quick start

**Requirements:** Node.js 22.17+, npm 10.9+

```bash
git clone https://github.com/Icohangar-ops/cup-pulse.git
cd cup-pulse
npm install
npm test
npm start
```

### Two-peer P2P demo (same machine)

**Terminal 1**

```bash
npm start
```

**Terminal 2** (must be in project directory)

```bash
npm run start:peer
```

Click **Add prediction** in one window — it should appear in the other after Hyperswarm/Hypercore sync.

### Verification

```bash
npm test
# 10 passing tests

test -f node_modules/electron/path.txt && echo "Electron OK"
```

---

## Scripts

| Command                    | Description                                                |
| -------------------------- | ---------------------------------------------------------- |
| `npm start`                | Launch Cup Pulse (peer 1)                                  |
| `npm run start:peer`       | Launch second instance (`--storage /tmp/cup-pulse-peer-2`) |
| `npm test`                 | Run unit tests                                             |
| `npm run repair:electron`  | Re-download Electron binary if install failed              |
| `npm run record:demo`      | Generate 3-min demo MP4 (Swift + FFmpeg)                   |
| `npm run record:demo:live` | Record live screen with FFmpeg (needs macOS permission)    |

---

## Troubleshooting

### `Electron failed to install correctly`

```bash
npm run repair:electron
npm start
```

### `npm run start:peer` — ENOENT package.json

Run from the project folder, not `~`:

```bash
cd cup-pulse-pear && npm run start:peer
```

### Pear upgrade key (production OTA only)

```bash
npx pear touch
# Paste pear:// link into package.json → "upgrade"
```

---

## BUIDL submission checklist

- [x] Public GitHub repository
- [x] Demo video (`demo/cup-pulse-demo.mp4`)
- [x] Pears Stack — Hyperswarm + Hypercore + Corestore + Bare worker
- [x] Football / tournament theme
- [x] No traditional client-server sync
- [x] README with architecture and run instructions
- [ ] DoraHacks BUIDL form submitted with repo + video links

### Copy-paste for DoraHacks

**Project name:** Cup Pulse

**Tagline:** P2P fan war room — predictions, watch-parties, and community pipelines with no server in the middle.

**Track:** Pears : Peer to Peer

**Tags:** `P2P`, `Pears`, `football`, `predictions`, `watch-party`, `Hyperswarm`, `Hypercore`, `local-first`, `fan community`

**Description:**

Cup Pulse is a peer-to-peer fan coordination app on the Pears Stack (Pear runtime, Hyperswarm, Hypercore, Autobase/Corestore). Fan groups sync match predictions, watch-party tasks, and pledge pipelines device-to-device with no central server. Deterministic risk scoring explains why a prediction or group is flagged. Built for the Tether Developers Cup football/tournament theme.

---

## Team

**Cubiczan** — solo builder  
**Nation:** United States _(update on DoraHacks if different)_

---

## Acknowledgements

- [smcateer-eliza/crm-pipeline-dashboard](https://github.com/smcateer-eliza/crm-pipeline-dashboard) — pipeline scoring & dashboard UX
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — agent skills ecosystem
- [holepunchto/hello-pear-electron](https://github.com/holepunchto/hello-pear-electron) — Pear + Electron scaffold
- [Tether Developers Cup](https://dorahacks.io/hackathon/tether-developers-cup/detail) — hackathon host

---

## License

MIT — see [LICENSE](./LICENSE).

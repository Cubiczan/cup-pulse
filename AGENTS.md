# AGENTS.md — Cup Pulse (Pears Stack)

Guidance for AI coding agents working on this [Tether Developers Cup](https://dorahacks.io/hackathon/tether-developers-cup/detail) submission.

**Track:** Pears : Peer to Peer  
**Stack:** Pear runtime, Hyperswarm, Hypercore, Corestore, Bare workers, Electron  
**Theme:** Football / global tournament — fans, predictions, watch-parties, communities

---

## Mission

Cup Pulse is a **peer-to-peer fan war room**. Organizers run a Pear app, invite friends into a Hyperswarm room, and sync predictions + watch-party tasks **without a central server**.

Pipeline scoring is **deterministic and explainable** — ported from [Pipeline Pulse CRM](https://github.com/smcateer-eliza/crm-pipeline-dashboard).

---

## Architecture

```text
electron/main.js       → PearRuntime, spawns Bare worker, IPC bridge
workers/main.js        → Hyperswarm room + Hypercore state log (P2P sync)
renderer/app.js        → Dashboard UI only
shared/cup.mjs          → Business logic (scoring, forecasts, summaries)
shared/seed.json       → Football-themed fixture data
```

### Rules

| Layer              | Do                              | Don't                  |
| ------------------ | ------------------------------- | ---------------------- |
| `workers/`         | P2P sync, Hypercore append, IPC | DOM, scoring math      |
| `shared/cup.mjs`   | Deterministic scoring           | Network calls          |
| `renderer/`        | Render UI, send IPC commands    | P2P or scoring logic   |
| `shared/seed.json` | Demo data shape                 | Hardcode records in UI |

**No traditional client-server networking** for sync. All replication goes through the Pears Stack.

---

## Domain model

| CRM concept | Cup Pulse concept                              |
| ----------- | ---------------------------------------------- |
| Account     | Fan club / watch-party group                   |
| Opportunity | Match prediction or pledge drive               |
| Stage       | Tournament round                               |
| Owner       | Community organizer                            |
| Risk score  | Stale group / missing next step / low coverage |

### Forecast buckets

`Commit`, `Best Case`, `Pipeline`, `At Risk`

---

## Verification

```bash
npm test
npm start
npm run start:peer   # second peer for P2P demo
```

Before submission:

- [ ] Two peers sync predictions
- [ ] Demo video recorded
- [ ] Public GitHub repo linked on DoraHacks

---

## Agent skills

Use curated skills from [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) when relevant:

| Task            | Skill                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Scoring changes | [test-driven-development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md) |
| P2P debugging   | [systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md)       |
| UI polish       | [frontend-design](https://officialskills.sh/anthropics/skills/frontend-design)                                   |
| Browser demo    | [webapp-testing](https://officialskills.sh/anthropics/skills/webapp-testing)                                     |

Install project skills in `.cursor/skills/`.

---

## References

- [Pears docs](https://docs.pears.com/)
- [hello-pear-electron](https://github.com/holepunchto/hello-pear-electron)
- [Hackathon tracks](https://dorahacks.io/hackathon/tether-developers-cup/tracks)

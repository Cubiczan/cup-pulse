# Optional hosted media layer

**Default: off. The hackathon build is unchanged.**

Cup Pulse ships as a fully peer-to-peer app and stays that way unless you
deliberately turn this on. Nothing in this document is part of the Pears track
submission, and enabling it weakens the claim the submission is built on. Read
the tradeoff before you touch it.

## Why this exists, and why it is off

The README promises watch-parties. Cup Pulse delivers the _coordination_ —
who's hosting, who's pledged, whose prediction is at risk — all replicating
peer-to-peer over Hypercore. What it never delivered is the watch-party itself:
people talking while the match is on.

Peer-to-peer audio does not scale to that. A full mesh where each of N fans
sends audio to N-1 peers starts falling apart around six participants, which is
smaller than an actual watch-party. Fixing that needs an SFU: one relay that
receives each stream once and fans it out. An SFU is, by definition, a server
in the middle.

So there are only two honest options, and this repo takes the second:

1. Pretend a mesh scales, and ship a feature that breaks at seven people.
2. Make hosted audio an explicit, off-by-default opt-in, and be precise about
   what it changes.

## What changes when you enable it

|                             | Media off (default)     | Media on                            |
| --------------------------- | ----------------------- | ----------------------------------- |
| Predictions, pledges, tasks | Hypercore, peer-to-peer | **Hypercore, peer-to-peer**         |
| Peer discovery              | Hyperswarm              | **Hyperswarm**                      |
| Cup Pulse server            | none                    | **none**                            |
| Watch-party voice           | unavailable             | relayed by Agora                    |
| Third party can observe     | nothing                 | that a call happened, and its audio |

The top four rows do not move. That is the design constraint, and
`assertStateStaysP2P()` enforces it: if the media config ever grows a key that
looks like state authority (`apiUrl`, `syncUrl`, `database`…), the renderer
throws rather than starting. A silent drift from "audio only" to "and also your
data" is exactly the failure this layer is shaped to prevent.

## Enabling it

Audio on requires `CUP_PULSE_MEDIA=on` and `AGORA_APP_ID`. Minting grants also
needs `AGORA_APP_CERTIFICATE` on the organizer machine. An app id alone does
nothing — a stray credential in a shell profile must never silently route a
watch-party through a third party.

```bash
export CUP_PULSE_MEDIA=on
export AGORA_APP_ID=<your Agora app id>
export AGORA_APP_CERTIFICATE=<only on the organizer machine>
export CUP_PULSE_MEDIA_MODE=broadcast   # or: roundtable
npm start
```

Only `on` counts. `true`, `1`, `yes`, and `enabled` all leave the layer off, on
purpose — an opt-in this consequential should be typed deliberately.

### Modes

- **`broadcast`** (default) — only the organizer speaks. Scales furthest, and
  is what "commentary over the match" actually wants.
- **`roundtable`** — everyone speaks. Right for a small group hanging out.

The mode is enforced in the _token_, not the UI. A fan in broadcast mode gets a
SUBSCRIBER credential, so a patched client still cannot publish.

## Token issuance without a server

Agora needs signed tokens, and signing needs the app certificate — a secret.
Cup Pulse has no server to keep a secret on, which normally kills this feature.

The way out: **the organizer is the issuer.**

The designed path, not yet wired to the Hypercore log:

```text
organizer's machine                          other peers
──────────────────                           ───────────
holds AGORA_APP_CERTIFICATE
mints a grant per peer      ── Hypercore ──▶  read the feed
  (channel, uid, role, token)                 pick their own newest valid grant
                                              join Agora with it
```

This PR ships the rules, the issuer IPC, and the join helper. It does **not**
append grants to Hypercore, and it does not mount a media toggle in the UI —
`WatchPartySession` is unused by `renderer/app.js`. Fans therefore cannot yet
receive a grant from the organizer's feed. Mixing tokens into the CRM state
log (`shared/cup.mjs`) is deliberately out of scope.

When that feed is wired, grants must not travel plaintext on a shared log: any
peer who can read the organizer's publisher token can join as the organizer
and speak. That encryption/private-feed work is a follow-up, not this PR.

What _is_ in place:

- **uids are derived from peer keys** (FNV-1a over the public key, in
  `shared/watch-party.mjs` so fans can compute their own), so a reconnecting
  peer keeps the same audio identity.
- **Publisher role is derived in main** from the identified local peer key,
  not from a renderer-supplied `isOrganizer` flag.
- **Issuer renewal** re-mints for the same channel on
  `token-privilege-will-expire`. Fan renewal waits on the unwired feed.
- **`selectGrantForPeer()`** is ready for append-only renewals once the feed
  exists; a leaked grant still reveals that a watch-party happened, not who
  predicted what.
- **Expiry has a 30-second skew guard**, so a peer refuses a nearly-dead token
  rather than joining and getting kicked mid-sentence.
- **The certificate never crosses the IPC bridge.** It lives in the main
  process; the renderer only ever sees finished tokens.
- **Join failures clean up.** Mic and client stay local until setup succeeds.

## Layout

| File                        | Role                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `shared/watch-party.mjs`    | All the rules. Pure, no I/O, no Cup Pulse state. Shared by main, renderer, and tests. |
| `electron/watch-party.js`   | Main process: holds the certificate, mints grants, exposes IPC.                       |
| `renderer/watch-party.js`   | Joins the audio channel. Loads the Agora SDK only after opt-in.                       |
| `test/watch-party.test.mjs` | Tests over the rules, including every way the opt-in can be got wrong.                |

Both Agora packages are `optionalDependencies`. An install that skips them
still boots a fully working peer-to-peer app; the media paths fail with a
message telling you what to install. The renderer never loads the ~1 MB SDK
unless someone actually opted in.

Audio only — no video. A watch-party is people reacting to a match they are all
already looking at; video would multiply bandwidth for the one stream nobody
watches.

## If you are judging the Pears track

Run it with no environment variables set. That is the submission: Hyperswarm
discovery, Hypercore replication, no server anywhere. `npm test` covers the
media layer's off-by-default behaviour explicitly, so you can verify the claim
rather than take it on trust.

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

Two variables, both required. An app id alone does nothing — a stray credential
in a shell profile must never silently route a watch-party through a third
party.

```bash
export CUP_PULSE_MEDIA=on
export AGORA_APP_ID=<your Agora app id>
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

```
organizer's machine                          other peers
──────────────────                           ───────────
holds AGORA_APP_CERTIFICATE
mints a grant per peer      ── Hypercore ──▶  read the feed
  (channel, uid, role, token)                 pick their own newest valid grant
                                              join Agora with it
```

The organizer is not a server. It is the peer who happens to own the Agora
project, minting credentials locally and appending them to the same feed
everything else already travels on. There is still no Cup Pulse infrastructure
anywhere — no API to call, nothing to deploy, nothing to keep running.

Details that make this work:

- **uids are derived from peer keys** (FNV-1a over the public key), so a peer
  that reconnects keeps the same audio identity with no negotiation.
- **Renewals append, they don't replace.** Hypercore is append-only, so a fresh
  grant lands next to the old one; `selectGrantForPeer()` takes the newest
  valid one. No deletion semantics needed.
- **Grants carry no Cup Pulse identity** — just channel, uid, role, token. A
  leaked grant reveals that a watch-party happened, not who predicted what.
- **Expiry has a 30-second skew guard**, so a peer refuses a nearly-dead token
  rather than joining and getting kicked mid-sentence.
- **The certificate never crosses the IPC bridge.** It lives in the main
  process; the renderer only ever sees finished tokens.

## Layout

| File                        | Role                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `shared/watch-party.mjs`    | All the rules. Pure, no I/O, no Cup Pulse state. Shared by main, renderer, and tests. |
| `electron/watch-party.js`   | Main process: holds the certificate, mints grants, exposes IPC.                       |
| `renderer/watch-party.js`   | Joins the audio channel. Loads the Agora SDK only after opt-in.                       |
| `test/watch-party.test.mjs` | 31 tests over the rules, including every way the opt-in can be got wrong.             |

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

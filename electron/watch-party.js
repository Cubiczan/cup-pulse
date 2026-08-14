// Main-process side of the optional media layer.
//
// The organizer's machine is the token issuer. That is not a server: it is the
// peer who happens to own the Agora project, minting credentials locally and
// handing them to other peers over the same Hypercore feed everything else
// travels on. No Cup Pulse infrastructure exists anywhere in this path.
//
// The app certificate lives here, in the main process, and never crosses into
// the renderer — the renderer only ever sees finished tokens.

// `shared/watch-party.mjs` is ESM and this file is CommonJS, so it is pulled in
// with a memoized dynamic import rather than require(). That keeps one copy of
// the rules shared with the renderer and the test suite.
let sharedPromise = null

function loadShared() {
  if (sharedPromise === null) sharedPromise = import('../shared/watch-party.mjs')
  return sharedPromise
}

// Loaded lazily and optionally: `agora-token` is an optionalDependency, so an
// install that skipped it must still boot a fully working P2P app.
let tokenBuilder
let tokenBuilderLoaded = false

function loadTokenBuilder() {
  if (tokenBuilderLoaded) return tokenBuilder
  tokenBuilderLoaded = true
  try {
    tokenBuilder = require('agora-token')
  } catch {
    tokenBuilder = null
  }
  return tokenBuilder
}

/**
 * Mint a grant for one peer. Resolves to null when this machine is not the
 * issuer or the media layer is off — callers treat null as "no audio", never
 * as an error worth interrupting the watch-party for.
 *
 * Publisher vs subscriber is derived here from the identified local peer key,
 * not from a renderer-supplied `isOrganizer` flag.
 */
async function mintGrant({
  env = process.env,
  matchId,
  peerKey,
  localPeerKey = null,
  now = Date.now()
}) {
  const shared = await loadShared()
  const config = shared.resolveMediaConfig(env)
  if (!config.enabled) return null
  if (!shared.isTokenIssuer(env)) return null

  const builder = loadTokenBuilder()
  if (!builder) {
    throw new Error(
      'agora-token is not installed. Run `npm install agora-token` to issue watch-party grants, ' +
        'or leave CUP_PULSE_MEDIA unset to run fully peer-to-peer.'
    )
  }

  const channel = shared.partyChannel(matchId)
  const uid = shared.mediaUid(peerKey)
  const isOrganizer = localPeerKey !== null && peerKey === localPeerKey
  const role = shared.publishRoleFor(config.mode, { isOrganizer })
  const issuedAt = Math.floor(now / 1000)

  const token = builder.RtcTokenBuilder.buildTokenWithUid(
    config.appId,
    String(env.AGORA_APP_CERTIFICATE).trim(),
    channel,
    uid,
    role === 'publisher' ? builder.RtcRole.PUBLISHER : builder.RtcRole.SUBSCRIBER,
    shared.GRANT_TTL_SECONDS,
    shared.GRANT_TTL_SECONDS
  )

  return shared.createTokenGrant({ channel, uid, role, token, issuedAt })
}

/**
 * Register the IPC surface. Called from electron/main.js.
 *
 * Only two things cross the bridge: the public config (never the certificate),
 * and finished grants.
 */
function registerWatchPartyIpc(ipcMain, { env = process.env } = {}) {
  // First identify() wins for the life of the process. The organizer machine
  // is the issuer; fans never reach mint(). A patched renderer on the issuer
  // already holds the certificate, so the bound key only stops it from
  // accidentally minting publisher tokens for other peers in broadcast mode.
  let localPeerKey = null

  ipcMain.handle('watch-party:config', async () => {
    const shared = await loadShared()
    const config = shared.resolveMediaConfig(env)
    return {
      enabled: config.enabled,
      appId: config.appId,
      mode: config.mode,
      reason: config.reason,
      canIssue: config.enabled && shared.isTokenIssuer(env)
    }
  })

  ipcMain.handle('watch-party:identify', (_event, peerKey) => {
    if (typeof peerKey !== 'string' || peerKey.trim() === '') {
      throw new Error('watch-party:identify requires a non-empty peerKey')
    }
    if (localPeerKey === null) localPeerKey = peerKey
    return { localPeerKey }
  })

  ipcMain.handle('watch-party:mint', (_event, payload) => {
    const { matchId, peerKey } = payload ?? {}
    if (typeof matchId !== 'string' || typeof peerKey !== 'string') {
      throw new Error('watch-party:mint requires string matchId and peerKey')
    }
    return mintGrant({ env, matchId, peerKey, localPeerKey })
  })
}

module.exports = { mintGrant, registerWatchPartyIpc }

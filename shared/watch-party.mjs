// Optional hosted media layer for watch-parties.
//
// READ THIS BEFORE ENABLING ANYTHING HERE.
//
// Cup Pulse's whole claim is "no server in the middle": peers find each other
// over Hyperswarm and state replicates over Hypercore. There is no API to go
// down, no operator who can read your data, nothing to shut off.
//
// Live voice is the one thing that claim cannot deliver well. A full mesh of
// N fans each sending audio to N-1 peers falls over somewhere around six
// people, which is smaller than a watch-party. Agora is an SFU: one hosted
// relay that fans audio out. It makes a 40-person watch-party work, and it
// puts a company in the middle of your audio.
//
// So this layer is:
//   * OFF by default, and off unless explicitly opted in per-run
//   * media only — predictions, pledges, tasks, and every byte of app state
//     stay on Hypercore, always, enabled or not
//   * honest in the UI about what it changes
//
// Nothing in this module reads or writes Cup Pulse state. That separation is
// the point: turning voice on must never move the data layer off P2P.

/** Tokens are short-lived; a watch-party outlives one, so peers renew. */
export const GRANT_TTL_SECONDS = 3600

/** Refuse a grant this close to expiry rather than joining and being kicked. */
const GRANT_SKEW_SECONDS = 30

/**
 * broadcast  — organizer talks, everyone else listens. Cheap, scales furthest,
 *              right for "commentary over the match".
 * roundtable — everyone can talk. Right for a small group actually hanging out.
 */
export const MEDIA_MODES = ['broadcast', 'roundtable']

export const MEDIA_OFF = Object.freeze({
  enabled: false,
  appId: null,
  mode: 'broadcast',
  reason:
    'Hosted media layer is off. Watch-party audio is disabled; all Cup Pulse state stays peer-to-peer.'
})

/**
 * Resolve the media layer config from an environment-like object.
 *
 * Opt-in is deliberately two-key: setting an app id alone does nothing. An
 * operator has to say `CUP_PULSE_MEDIA=on` as well, so a stray credential in
 * a shell profile can never silently route a watch-party through a third
 * party.
 */
export function resolveMediaConfig(env = {}) {
  const flag = String(env.CUP_PULSE_MEDIA ?? '')
    .trim()
    .toLowerCase()

  if (flag !== 'on') {
    return MEDIA_OFF
  }

  const appId = String(env.AGORA_APP_ID ?? '').trim()
  if (appId === '') {
    return {
      ...MEDIA_OFF,
      reason: 'CUP_PULSE_MEDIA=on but AGORA_APP_ID is unset — media layer stays off.'
    }
  }

  const requested = String(env.CUP_PULSE_MEDIA_MODE ?? 'broadcast')
    .trim()
    .toLowerCase()
  const mode = MEDIA_MODES.includes(requested) ? requested : 'broadcast'

  return {
    enabled: true,
    appId,
    mode,
    reason:
      'Hosted media layer is ON. Watch-party audio is relayed by Agora, a third party. ' +
      'Predictions, pledges, and tasks remain peer-to-peer.'
  }
}

/**
 * Can this peer mint tokens for others?
 *
 * Only the organizer holds the Agora app certificate — it is a secret, and
 * Cup Pulse has no server to keep it on. So the organizer's own machine mints
 * grants and replicates them over the existing Hypercore feed. There is still
 * no Cup Pulse server anywhere; the organizer is simply the peer who happens
 * to own the Agora project.
 */
export function isTokenIssuer(env = {}) {
  return String(env.AGORA_APP_CERTIFICATE ?? '').trim() !== ''
}

/**
 * Agora channel names are constrained, and this one gets interpolated into
 * REST paths and SDK calls, so reject anything that could smuggle a separator.
 */
export function isValidChannelName(channel) {
  return /^[A-Za-z0-9!#$%&()+\-:;<=.>?@[\]^_{|}~,]{1,64}$/.test(channel)
}

/** Channel name for a match's watch-party. */
export function partyChannel(matchId) {
  const channel = `cup-${String(matchId).trim()}`
  if (!isValidChannelName(channel)) {
    throw new Error(`match id "${matchId}" produces an invalid media channel name`)
  }
  return channel
}

/**
 * Who may publish audio.
 *
 * In broadcast mode only the organizer publishes. Enforced when the grant is
 * minted, not in the UI — a patched client still cannot publish, because the
 * privilege was never in its token.
 */
export function publishRoleFor(mode, { isOrganizer }) {
  if (mode === 'roundtable') return 'publisher'
  return isOrganizer ? 'publisher' : 'subscriber'
}

/**
 * A token grant as it travels over Hypercore.
 *
 * Deliberately carries no Cup Pulse identity — just an Agora uid, the channel,
 * and the credential. A grant leaking tells an observer that a watch-party
 * happened, not who predicted what.
 */
export function createTokenGrant({
  channel,
  uid,
  role,
  token,
  issuedAt,
  ttlSeconds = GRANT_TTL_SECONDS
}) {
  if (!isValidChannelName(channel)) {
    throw new Error(`invalid media channel name: "${channel}"`)
  }
  if (!Number.isInteger(uid) || uid < 1 || uid > 0xffffffff) {
    throw new Error(`invalid media uid: ${uid}`)
  }
  if (role !== 'publisher' && role !== 'subscriber') {
    throw new Error(`invalid media role: ${role}`)
  }
  if (typeof token !== 'string' || token === '') {
    throw new Error('token grant requires a token')
  }
  if (!Number.isFinite(issuedAt)) {
    throw new Error('token grant requires a numeric issuedAt (unix seconds)')
  }

  return {
    kind: 'agora-token-grant',
    channel,
    uid,
    role,
    token,
    issuedAt,
    expiresAt: issuedAt + ttlSeconds
  }
}

/** Shape + freshness check for a grant received from another peer. */
export function validateTokenGrant(grant, nowSeconds) {
  if (grant === null || typeof grant !== 'object') return { valid: false, reason: 'not an object' }
  if (grant.kind !== 'agora-token-grant') return { valid: false, reason: 'wrong record kind' }
  if (!isValidChannelName(String(grant.channel ?? ''))) {
    return { valid: false, reason: 'invalid channel' }
  }
  if (!Number.isInteger(grant.uid) || grant.uid < 1) return { valid: false, reason: 'invalid uid' }
  if (grant.role !== 'publisher' && grant.role !== 'subscriber') {
    return { valid: false, reason: 'invalid role' }
  }
  if (typeof grant.token !== 'string' || grant.token === '') {
    return { valid: false, reason: 'missing token' }
  }
  if (!Number.isFinite(grant.expiresAt)) return { valid: false, reason: 'missing expiry' }
  if (grant.expiresAt - GRANT_SKEW_SECONDS <= nowSeconds) {
    return { valid: false, reason: 'expired' }
  }
  return { valid: true, reason: 'ok' }
}

/**
 * Pick the grant a peer should use: the newest still-valid one for this uid.
 *
 * Grants arrive over an append-only log, so a renewal does not replace the
 * old record — it lands next to it. Taking the newest valid one is what makes
 * renewal work without any deletion semantics.
 */
export function selectGrantForPeer(grants, uid, nowSeconds) {
  if (!Array.isArray(grants)) return null

  let best = null
  for (const grant of grants) {
    if (grant?.uid !== uid) continue
    if (!validateTokenGrant(grant, nowSeconds).valid) continue
    if (best === null || grant.issuedAt > best.issuedAt) best = grant
  }
  return best
}

/**
 * What the user is actually agreeing to. Rendered in the UI next to the
 * toggle — an opt-in nobody understands is not really an opt-in.
 */
export function describeTradeoff(config) {
  if (!config.enabled) {
    return {
      headline: 'Fully peer-to-peer',
      points: [
        'Predictions, pledges, and tasks replicate directly between peers',
        'No third party can see your watch-party',
        'Live voice is unavailable'
      ]
    }
  }

  return {
    headline: 'Peer-to-peer state, hosted audio',
    points: [
      'Predictions, pledges, and tasks still replicate directly between peers',
      'Watch-party voice is relayed by Agora and leaves the P2P network',
      config.mode === 'broadcast'
        ? 'Broadcast mode: only the organizer can speak'
        : 'Roundtable mode: everyone can speak',
      'Turning this off restores a fully peer-to-peer app'
    ]
  }
}

/**
 * Guard against the failure mode this whole design exists to prevent: a media
 * config that has somehow acquired authority over app state. Called by the
 * renderer before enabling; throws rather than degrades, because a silent
 * degrade here would be exactly the dishonesty the module is avoiding.
 */
export function assertStateStaysP2P(config) {
  const leaked = ['storage', 'stateEndpoint', 'apiUrl', 'syncUrl', 'database'].filter(
    (key) => key in config
  )
  if (leaked.length > 0) {
    throw new Error(
      `media config must not carry state-layer keys (found: ${leaked.join(', ')}). ` +
        'Cup Pulse state is peer-to-peer; the media layer is audio only.'
    )
  }
  return true
}

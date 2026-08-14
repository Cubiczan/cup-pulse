import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  GRANT_TTL_SECONDS,
  MEDIA_MODES,
  assertStateStaysP2P,
  createTokenGrant,
  describeTradeoff,
  isTokenIssuer,
  isValidChannelName,
  partyChannel,
  publishRoleFor,
  resolveMediaConfig,
  selectGrantForPeer,
  validateTokenGrant
} from '../shared/watch-party.mjs'

const NOW = 1_770_000_000

function grant(overrides = {}) {
  return createTokenGrant({
    channel: 'cup-final',
    uid: 42,
    role: 'subscriber',
    token: 'token-abc',
    issuedAt: NOW,
    ...overrides
  })
}

describe('resolveMediaConfig', () => {
  it('is off when nothing is set — the default must be fully peer-to-peer', () => {
    const config = resolveMediaConfig({})
    assert.equal(config.enabled, false)
    assert.match(config.reason, /stays peer-to-peer|off/i)
  })

  it('stays off when only a credential is present, with no explicit opt-in', () => {
    const config = resolveMediaConfig({ AGORA_APP_ID: 'app-id' })
    assert.equal(config.enabled, false)
  })

  it('stays off when opted in but no app id is configured', () => {
    const config = resolveMediaConfig({ CUP_PULSE_MEDIA: 'on' })
    assert.equal(config.enabled, false)
    assert.match(config.reason, /AGORA_APP_ID is unset/)
  })

  it('enables only with both the opt-in flag and an app id', () => {
    const config = resolveMediaConfig({ CUP_PULSE_MEDIA: 'on', AGORA_APP_ID: 'app-id' })
    assert.equal(config.enabled, true)
    assert.equal(config.appId, 'app-id')
    assert.match(config.reason, /third party/i)
  })

  it('does not treat truthy-looking values as opt-in', () => {
    for (const value of ['true', '1', 'yes', 'enabled', 'ON ']) {
      const config = resolveMediaConfig({ CUP_PULSE_MEDIA: value, AGORA_APP_ID: 'app-id' })
      if (value.trim().toLowerCase() === 'on') continue
      assert.equal(config.enabled, false, `"${value}" should not enable the media layer`)
    }
  })

  it('accepts "on" case-insensitively and with surrounding whitespace', () => {
    const config = resolveMediaConfig({ CUP_PULSE_MEDIA: ' On ', AGORA_APP_ID: 'app-id' })
    assert.equal(config.enabled, true)
  })

  it('defaults to broadcast and rejects an unknown mode', () => {
    const base = { CUP_PULSE_MEDIA: 'on', AGORA_APP_ID: 'app-id' }
    assert.equal(resolveMediaConfig(base).mode, 'broadcast')
    assert.equal(resolveMediaConfig({ ...base, CUP_PULSE_MEDIA_MODE: 'chaos' }).mode, 'broadcast')
    assert.equal(
      resolveMediaConfig({ ...base, CUP_PULSE_MEDIA_MODE: 'roundtable' }).mode,
      'roundtable'
    )
  })

  it('exposes only the modes it documents', () => {
    assert.deepEqual(MEDIA_MODES, ['broadcast', 'roundtable'])
  })
})

describe('isTokenIssuer', () => {
  it('is false without a certificate — most peers never mint anything', () => {
    assert.equal(isTokenIssuer({}), false)
    assert.equal(isTokenIssuer({ AGORA_APP_CERTIFICATE: '   ' }), false)
  })

  it('is true on the organizer machine that holds the certificate', () => {
    assert.equal(isTokenIssuer({ AGORA_APP_CERTIFICATE: 'cert' }), true)
  })
})

describe('channel names', () => {
  it('accepts the names we generate', () => {
    assert.equal(isValidChannelName('cup-final'), true)
    assert.equal(partyChannel('final'), 'cup-final')
  })

  it('rejects separators that could escape a URL path', () => {
    assert.equal(isValidChannelName('cup/../admin'), false)
    assert.equal(isValidChannelName('cup final'), false)
    assert.equal(isValidChannelName(''), false)
    assert.equal(isValidChannelName('c'.repeat(65)), false)
  })

  it('throws rather than emitting an unsafe channel name', () => {
    assert.throws(() => partyChannel('../evil'), /invalid media channel name/)
  })
})

describe('publishRoleFor', () => {
  it('lets only the organizer speak in broadcast mode', () => {
    assert.equal(publishRoleFor('broadcast', { isOrganizer: true }), 'publisher')
    assert.equal(publishRoleFor('broadcast', { isOrganizer: false }), 'subscriber')
  })

  it('lets everyone speak in roundtable mode', () => {
    assert.equal(publishRoleFor('roundtable', { isOrganizer: false }), 'publisher')
  })
})

describe('createTokenGrant', () => {
  it('sets the expiry from the issue time', () => {
    const record = grant()
    assert.equal(record.kind, 'agora-token-grant')
    assert.equal(record.expiresAt, NOW + GRANT_TTL_SECONDS)
  })

  it('carries no Cup Pulse identity — a leaked grant reveals no predictions', () => {
    assert.deepEqual(Object.keys(grant()).sort(), [
      'channel',
      'expiresAt',
      'issuedAt',
      'kind',
      'role',
      'token',
      'uid'
    ])
  })

  it('rejects malformed input', () => {
    assert.throws(() => grant({ channel: 'bad/name' }), /invalid media channel name/)
    assert.throws(() => grant({ uid: 0 }), /invalid media uid/)
    assert.throws(() => grant({ role: 'admin' }), /invalid media role/)
    assert.throws(() => grant({ token: '' }), /requires a token/)
    assert.throws(() => grant({ issuedAt: 'soon' }), /numeric issuedAt/)
  })
})

describe('validateTokenGrant', () => {
  it('accepts a fresh grant', () => {
    assert.equal(validateTokenGrant(grant(), NOW).valid, true)
  })

  it('rejects an expired grant', () => {
    const result = validateTokenGrant(grant(), NOW + GRANT_TTL_SECONDS + 1)
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'expired')
  })

  it('rejects a grant inside the skew window rather than joining and being kicked', () => {
    const result = validateTokenGrant(grant(), NOW + GRANT_TTL_SECONDS - 5)
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'expired')
  })

  it('rejects junk from the wire', () => {
    assert.equal(validateTokenGrant(null, NOW).valid, false)
    assert.equal(validateTokenGrant({ kind: 'something-else' }, NOW).valid, false)
    assert.equal(validateTokenGrant({ ...grant(), token: '' }, NOW).valid, false)
    assert.equal(validateTokenGrant({ ...grant(), role: 'admin' }, NOW).valid, false)
    assert.equal(validateTokenGrant({ ...grant(), uid: -1 }, NOW).valid, false)
    assert.equal(validateTokenGrant({ ...grant(), channel: 'a/b' }, NOW).valid, false)
  })
})

describe('selectGrantForPeer', () => {
  it('picks the newest valid grant, because renewals append rather than replace', () => {
    const older = grant({ token: 'old', issuedAt: NOW - 100 })
    const newer = grant({ token: 'new', issuedAt: NOW })
    const picked = selectGrantForPeer([older, newer], 42, NOW)
    assert.equal(picked.token, 'new')
  })

  it('ignores grants belonging to other peers', () => {
    const mine = grant({ uid: 42 })
    const theirs = grant({ uid: 99, issuedAt: NOW + 10 })
    assert.equal(selectGrantForPeer([theirs, mine], 42, NOW).uid, 42)
  })

  it('returns null when every grant for this peer has expired', () => {
    const stale = grant({ issuedAt: NOW - GRANT_TTL_SECONDS - 10 })
    assert.equal(selectGrantForPeer([stale], 42, NOW), null)
  })

  it('tolerates a non-array feed', () => {
    assert.equal(selectGrantForPeer(undefined, 42, NOW), null)
  })
})

describe('describeTradeoff', () => {
  it('says live voice is unavailable when the layer is off', () => {
    const tradeoff = describeTradeoff({ enabled: false })
    assert.match(tradeoff.headline, /peer-to-peer/i)
    assert.ok(tradeoff.points.some((p) => /voice is unavailable/i.test(p)))
  })

  it('states plainly that audio leaves the P2P network when on', () => {
    const tradeoff = describeTradeoff({ enabled: true, mode: 'broadcast' })
    assert.ok(tradeoff.points.some((p) => /leaves the P2P network/i.test(p)))
    assert.ok(tradeoff.points.some((p) => /still replicate directly between peers/i.test(p)))
  })

  it('describes the active speaking mode', () => {
    assert.ok(
      describeTradeoff({ enabled: true, mode: 'roundtable' }).points.some((p) =>
        /everyone can speak/i.test(p)
      )
    )
  })
})

describe('assertStateStaysP2P', () => {
  it('passes for a media-only config', () => {
    assert.equal(assertStateStaysP2P({ enabled: true, appId: 'a', mode: 'broadcast' }), true)
  })

  it('throws if the media config ever grows authority over app state', () => {
    assert.throws(
      () => assertStateStaysP2P({ enabled: true, apiUrl: 'https://example.com' }),
      /must not carry state-layer keys/
    )
  })
})

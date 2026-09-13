// Renderer side of the optional media layer.
//
// Loads the Agora Web SDK only when a user has actually opted in. The SDK is
// an optionalDependency and roughly a megabyte; a fully peer-to-peer run must
// never pay for it, so nothing here is imported at module scope.

import {
  assertStateStaysP2P,
  describeTradeoff,
  mediaUid,
  partyChannel,
  selectGrantForPeer,
  validateTokenGrant
} from '../shared/watch-party.mjs'

// UMD build, loaded via a script tag. The renderer is sandboxed with
// contextIsolation, so it cannot require() a node module — but a plain browser
// bundle on disk is just a page script.
const SDK_PATH = '../node_modules/agora-rtc-sdk-ng/AgoraRTC_N-production.js'

let sdkPromise = null

function loadSdk() {
  if (sdkPromise !== null) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    if (window.AgoraRTC) {
      resolve(window.AgoraRTC)
      return
    }
    const script = document.createElement('script')
    script.src = SDK_PATH
    script.async = true
    script.onload = () => {
      if (window.AgoraRTC) resolve(window.AgoraRTC)
      else reject(new Error('Agora SDK loaded but did not register AgoraRTC'))
    }
    script.onerror = () => {
      reject(
        new Error(
          'Agora Web SDK is not installed. Run `npm install agora-rtc-sdk-ng` to enable ' +
            'watch-party audio, or leave the media layer off to run fully peer-to-peer.'
        )
      )
    }
    document.head.appendChild(script)
  })

  return sdkPromise
}

/**
 * Audio-only watch-party session.
 *
 * Voice, not video, on purpose: a watch-party is people reacting to a match
 * they are all already looking at. Video would multiply the bandwidth for the
 * one stream nobody watches.
 */
export class WatchPartySession {
  constructor(bridge) {
    this.bridge = bridge
    this.config = null
    this.client = null
    this.micTrack = null
    this.grant = null
    this._joinArgs = null
    this.listeners = new Set()
  }

  onChange(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit() {
    const snapshot = this.status()
    for (const listener of this.listeners) listener(snapshot)
  }

  status() {
    return {
      enabled: this.config?.enabled === true,
      joined: this.client !== null,
      speaking: this.micTrack !== null,
      mode: this.config?.mode ?? 'broadcast',
      reason: this.config?.reason ?? '',
      tradeoff: describeTradeoff(this.config ?? { enabled: false })
    }
  }

  /** Ask the main process what the media layer is set to. Safe to call always. */
  async load() {
    this.config = await this.bridge.watchParty.config()
    assertStateStaysP2P(this.config)
    this.emit()
    return this.config
  }

  /**
   * Join the watch-party audio channel.
   *
   * Issuer machines mint locally. Everyone else waits for a grant the
   * organizer has already issued — Hypercore distribution of those grants is
   * not wired in this PR (see docs/watch-party-media.md).
   */
  async join({ matchId, peerKey, grants }) {
    if (!this.config) await this.load()
    if (!this.config.enabled) {
      throw new Error('Media layer is off. Set CUP_PULSE_MEDIA=on to enable watch-party audio.')
    }
    if (this.client) return this.status()

    const now = Math.floor(Date.now() / 1000)
    const expectedChannel = partyChannel(matchId)
    let grant = null

    if (this.config.canIssue) {
      await this.bridge.watchParty.identify(peerKey)
      grant = await this.bridge.watchParty.mint({ matchId, peerKey })
    } else {
      grant = selectGrantForPeer(grants?.records, mediaUid(peerKey), now)
    }

    if (grant === null) {
      throw new Error('No valid watch-party token yet — waiting for the organizer to issue one.')
    }
    const check = validateTokenGrant(grant, now, { expectedChannel })
    if (!check.valid) {
      throw new Error(`Watch-party token rejected: ${check.reason}`)
    }

    const AgoraRTC = await loadSdk()
    AgoraRTC.setLogLevel(2)

    // Live mode so broadcast/audience roles are meaningful; the token already
    // decides whether this peer may publish, so a patched client gains nothing.
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
    let micTrack = null
    try {
      await client.setClientRole(grant.role === 'publisher' ? 'host' : 'audience')

      client.on('user-published', async (user, mediaType) => {
        if (mediaType !== 'audio') return
        await client.subscribe(user, mediaType)
        user.audioTrack?.play()
      })

      if (this.config.canIssue) {
        client.on('token-privilege-will-expire', () => {
          void this._renewIssuerToken()
        })
      }

      await client.join(this.config.appId, grant.channel, grant.token, grant.uid)

      if (grant.role === 'publisher') {
        micTrack = await AgoraRTC.createMicrophoneAudioTrack()
        await client.publish([micTrack])
      }
    } catch (error) {
      if (micTrack) {
        try {
          await client.unpublish([micTrack])
        } catch {
          // Best-effort; the track may never have been published.
        }
        micTrack.stop()
        micTrack.close()
      }
      try {
        await client.leave()
      } catch {
        // Best-effort; join itself may have failed.
      }
      client.removeAllListeners()
      throw error
    }

    this.client = client
    this.micTrack = micTrack
    this.grant = grant
    this._joinArgs = { matchId, peerKey }
    this.emit()
    return this.status()
  }

  async _renewIssuerToken() {
    const args = this._joinArgs
    const client = this.client
    if (!args || !client || !this.config?.canIssue) return
    try {
      const fresh = await this.bridge.watchParty.mint({
        matchId: args.matchId,
        peerKey: args.peerKey
      })
      if (!fresh?.token) return
      const check = validateTokenGrant(fresh, Math.floor(Date.now() / 1000), {
        expectedChannel: partyChannel(args.matchId)
      })
      if (!check.valid) return
      await client.renewToken(fresh.token)
      this.grant = fresh
    } catch {
      // The call will end at expiry.
    }
  }

  async setMuted(muted) {
    if (!this.micTrack) return
    await this.micTrack.setEnabled(!muted)
    this.emit()
  }

  /** Leave audio. Cup Pulse state keeps replicating over Hypercore regardless. */
  async leave() {
    if (this.micTrack) {
      this.micTrack.stop()
      this.micTrack.close()
      this.micTrack = null
    }
    if (this.client) {
      try {
        await this.client.leave()
      } catch {
        // Leaving a channel we already left is not worth surfacing.
      }
      this.client.removeAllListeners()
      this.client = null
    }
    this.grant = null
    this._joinArgs = null
    this.emit()
  }
}

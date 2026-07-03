/**
 * web/src/lib/voice.ts — WebRTC voice mesh for Sigil (#76)
 *
 * Strategy:
 *   - Full-mesh: every seat opens a PeerConnection to every other seat.
 *   - Signalling is relayed through the Colyseus room (voiceOffer / voiceAnswer / voiceIce
 *     intents → GameRoom.ts → targeted send to the correct client).
 *   - Works peer-to-peer on a LAN without a TURN server.
 *   - TODO(TURN): For cross-NAT (public internet) add TURN server credentials.
 *     Set VITE_TURN_URL (e.g. "turn:turn.example.com:3478"), VITE_TURN_USER, VITE_TURN_CRED
 *     and they will be picked up in iceServers below.
 *
 * Usage (in ChatPanel or Tabletop, after useRoom() is wired):
 *
 *   const voiceMesh = useVoiceMesh({ room, mySeat, enabled: VOICE_CHAT_ENABLED })
 *   // voiceMesh.muted, voiceMesh.toggleMute(), voiceMesh.peers
 *
 * Gated: VITE_VOICE_CHAT_ENABLED=true must be set for the mesh to activate.
 * Without it, useVoiceMesh is a no-op (returns { muted: true, toggleMute: noop, peers: [] }).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type Colyseus from 'colyseus.js'

// ── Config ────────────────────────────────────────────────────────────────────

const VOICE_ENABLED = import.meta.env.VITE_VOICE_CHAT_ENABLED === 'true'

// ICE servers: STUN always; TURN only when env vars are set
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  const turnUrl  = import.meta.env.VITE_TURN_URL
  const turnUser = import.meta.env.VITE_TURN_USER
  const turnCred = import.meta.env.VITE_TURN_CRED

  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred })
  }

  return servers
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PeerEntry {
  seat: number
  pc: RTCPeerConnection
  stream: MediaStream | null
  speaking: boolean
}

export interface VoiceMeshReturn {
  /** Whether local mic is muted. */
  muted: boolean
  /** Toggle local mic mute. */
  toggleMute: () => void
  /** Current peer entries (one per remote seat). */
  peers: PeerEntry[]
  /** Whether the mesh is active (voice enabled + room connected). */
  active: boolean
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseVoiceMeshOptions {
  /** Colyseus room instance (from useRoom()). */
  room: Colyseus.Room | null
  /** Local seat number. */
  mySeat: number
  /** Total seats in the game. */
  totalSeats?: number
  /** Whether to activate voice at all. Default: reads VITE_VOICE_CHAT_ENABLED. */
  enabled?: boolean
}

export function useVoiceMesh({
  room,
  mySeat,
  totalSeats = 4,
  enabled = VOICE_ENABLED,
}: UseVoiceMeshOptions): VoiceMeshReturn {

  const [muted, setMuted]   = useState(true)
  const [peers, setPeers]   = useState<PeerEntry[]>([])
  const localStreamRef      = useRef<MediaStream | null>(null)
  const pcsRef              = useRef<Map<number, RTCPeerConnection>>(new Map())
  const iceServers          = useRef(buildIceServers())

  // ── Cleanup helper ──────────────────────────────────────────────────────────

  const closeAll = useCallback(() => {
    for (const pc of pcsRef.current.values()) pc.close()
    pcsRef.current.clear()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setPeers([])
  }, [])

  // ── Build a PeerConnection for a remote seat ────────────────────────────────

  const buildPC = useCallback((remoteSeat: number, polite: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: iceServers.current })

    // Trickle ICE
    pc.onicecandidate = (e) => {
      if (!e.candidate || !room) return
      room.send('intent', {
        type: 'voiceIce',
        toSeat: remoteSeat,
        candidate: JSON.stringify(e.candidate),
      })
    }

    // Remote track → update peer stream
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track])
      setPeers((prev) => prev.map((p) =>
        p.seat === remoteSeat ? { ...p, stream } : p
      ))
    }

    // Negotiate (Perfect Negotiation pattern)
    pc.onnegotiationneeded = async () => {
      if (!room) return
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        room.send('intent', {
          type: 'voiceOffer',
          toSeat: remoteSeat,
          sdp: JSON.stringify(pc.localDescription),
        })
      } catch (err) {
        console.warn('[voice] negotiationneeded error', err)
      }
    }

    // Add local tracks
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current)
      }
    }

    pcsRef.current.set(remoteSeat, pc)
    setPeers((prev) => {
      if (prev.find((p) => p.seat === remoteSeat)) return prev
      return [...prev, { seat: remoteSeat, pc, stream: null, speaking: false }]
    })

    void polite  // polite flag used in perfect negotiation — reserved for collision handling
    return pc
  }, [room])

  // ── Main effect: get mic + wire signalling ──────────────────────────────────

  useEffect(() => {
    if (!enabled || !room) return

    let cancelled = false

    async function init() {
      // Get microphone
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      } catch (err) {
        console.warn('[voice] getUserMedia failed (no mic?)', err)
        return
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }

      // Start muted
      stream.getAudioTracks().forEach((t) => { t.enabled = false })
      localStreamRef.current = stream

      // Initiate connections to all higher-numbered seats (lower seat is polite)
      for (let s = 0; s < totalSeats; s++) {
        if (s === mySeat) continue
        buildPC(s, mySeat > s)
      }

      // ── Incoming signalling ──────────────────────────────────────────

      room!.onMessage<{ fromSeat: number; sdp: string }>('voiceOffer', async ({ fromSeat, sdp }) => {
        if (cancelled) return
        let pc = pcsRef.current.get(fromSeat)
        if (!pc) pc = buildPC(fromSeat, true)
        const desc = JSON.parse(sdp) as RTCSessionDescriptionInit
        await pc.setRemoteDescription(desc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        room!.send('intent', {
          type: 'voiceAnswer',
          toSeat: fromSeat,
          sdp: JSON.stringify(pc.localDescription),
        })
      })

      room!.onMessage<{ fromSeat: number; sdp: string }>('voiceAnswer', async ({ fromSeat, sdp }) => {
        if (cancelled) return
        const pc = pcsRef.current.get(fromSeat)
        if (!pc) return
        const desc = JSON.parse(sdp) as RTCSessionDescriptionInit
        await pc.setRemoteDescription(desc)
      })

      room!.onMessage<{ fromSeat: number; candidate: string }>('voiceIce', async ({ fromSeat, candidate }) => {
        if (cancelled) return
        const pc = pcsRef.current.get(fromSeat)
        if (!pc) return
        try {
          await pc.addIceCandidate(JSON.parse(candidate) as RTCIceCandidateInit)
        } catch (err) {
          console.warn('[voice] addIceCandidate error', err)
        }
      })
    }

    void init()

    return () => {
      cancelled = true
      closeAll()
    }
  }, [enabled, room, mySeat, totalSeats, buildPC, closeAll])

  // ── Mute toggle ─────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newMuted = !muted
    stream.getAudioTracks().forEach((t) => { t.enabled = !newMuted })
    setMuted(newMuted)
  }, [muted])

  if (!enabled) {
    return { muted: true, toggleMute: () => {}, peers: [], active: false }
  }

  return { muted, toggleMute, peers, active: !!room }
}

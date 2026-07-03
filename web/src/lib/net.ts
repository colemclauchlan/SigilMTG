/**
 * web/src/lib/net.ts — Sigil Phase 3: Colyseus client hook
 *
 * Provides `useRoom()` — a React hook that:
 *   1. Connects to the game server via Colyseus.js WebSocket
 *   2. Joins (or creates) a room by roomId / roomCode
 *   3. Receives per-seat snapshots → writes them into the Zustand store
 *   4. Exposes `sendIntent(intent)` so the /play Tabletop can send actions
 *      without knowing anything about WebSocket internals
 *
 * The Zustand store shape is unchanged (Phase 2 store); we only write
 * `gameState`, `mySeat`, `connectionStatus`, `roomId`, and log entries.
 *
 * Usage:
 *   const { sendIntent, connected, room } = useRoom({ roomId: 'abc123' })
 *   sendIntent({ type: 'passTurn' })
 *
 * The hook is safe to call in StrictMode (double-mount) — it tracks the
 * current room ref and cleans up on unmount.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import Colyseus from 'colyseus.js'
import { useGameStore } from '../store/gameStore'

// ── Intent types mirrored from server (no runtime dep on server types) ────────

export type IntentType =
  | 'joinGame'
  | 'setLife'
  | 'passTurn'
  | 'passPriority'
  | 'setManualMode'
  | 'stackPush'
  | 'stackResolve'
  | 'stackRemove'
  | 'stackReorder'
  | 'cardMove'
  | 'cardTap'
  | 'untapAll'
  | 'draw'
  | 'cardCounter'
  | 'setPhase'
  | 'playerCounter'
  | 'commanderDamage'
  | 'createToken'
  | 'cardFlip'
  | 'cardTransform'
  | 'cardClone'
  | 'shuffle'
  | 'mill'
  | 'boardWipe'
  | 'undoLast'
  | 'declareAttackers'
  | 'declareBlockers'
  | 'resolveCombat'
  | 'target'
  | 'test'
  | 'chat'
  | 'lockIn'
  | 'startGame'
  | 'diceRoll'
  | 'voiceOffer'
  | 'voiceAnswer'
  | 'voiceIce'

export interface Intent {
  type: IntentType
  [key: string]: unknown
}

// ── Snapshot shape sent from server (mirrors SeatSnapshot in engine/index.ts) ─

export interface CardSnapshot {
  instanceId: string
  cardId: string | null
  name: string
  ownerSeat: number
  controllerSeat: number
  zone: string
  pos: number
  x: number | null
  y: number | null
  z: number
  tapped: boolean
  faceDown: boolean
  flipped: number
  phased: boolean
  attacking: boolean
  counters: Record<string, number>
  attachedTo: string | null
  isToken: boolean
  isCommander: boolean
  setCode: string | null
  collectorNumber: string | null
  revealedTo: number[]
}

export interface EngineSnapshot {
  estate: {
    game: {
      seats: number
      activeSeat: number
      turn: number
      phase: string
      players: Array<{
        seat: number
        life: number
        counters: Record<string, number>
        cmdDamage: Record<string, number>
      }>
      cards: Record<string, CardSnapshot>
      annotations: Record<string, unknown>
    }
    stack: Array<{
      id: string
      controllerSeat: number
      kind: string
      source: string | null
      effects: unknown[]
      targets: unknown[]
    }>
    priority: number
    step: string
  }
  viewingSeat: number
  opponentZoneCounts: Record<string, { hand: number; library: number }>
}

// ── Hook options / return ─────────────────────────────────────────────────────

export interface UseRoomOptions {
  /** Join by specific room ID (reconnect). Omit to create a new room. */
  roomId?: string
  /** Display name sent on join. */
  displayName?: string
  /** Manual mode flag sent to server on room create. */
  manual?: boolean
  /** Auto-connect on mount (default true). */
  autoConnect?: boolean
  /** Join as spectator (read-only). Server strips hidden info for all seats. */
  spectate?: boolean
  /** Called when spectatorCount changes (for "N watching" banner). */
  onSpectatorCount?: (n: number) => void
  /** Called when a reconnection succeeds (for showing 'Reconnected' banner §57). */
  onReconnected?: () => void
}

export interface UseRoomReturn {
  /** Whether the WebSocket connection is open and the room is joined. */
  connected: boolean
  /** Current Colyseus.Room instance (null before join). */
  room: Colyseus.Room | null
  /** Typed intent sender — fire-and-forget. */
  sendIntent: (intent: Intent) => void
  /** Manually trigger connect (only needed when autoConnect=false). */
  connect: () => void
  /** Leave the room and close the connection. */
  disconnect: () => void
  /** Last connection error, if any. */
  error: string | null
  /** True briefly after a reconnect (§57). */
  justReconnected: boolean
  /** True when joined as spectator. */
  isSpectator: boolean
  /** Current watcher count broadcast by server. */
  spectatorCount: number
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useRoom(opts: UseRoomOptions = {}): UseRoomReturn {
  const {
    roomId: targetRoomId,
    displayName,
    manual = false,
    autoConnect = true,
    spectate = false,
    onSpectatorCount,
    onReconnected,
  } = opts

  const roomRef   = useRef<Colyseus.Room | null>(null)
  const clientRef = useRef<Colyseus.Client | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [justReconnected, setJustReconnected] = useState(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [spectatorCount, setSpectatorCount] = useState(0)

  const store = useGameStore()

  // ── Connect / join ─────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (roomRef.current) return  // already joined

    const serverUrl = store.serverUrl || 'ws://localhost:2567'
    store.setConnectionStatus('connecting')
    setError(null)

    try {
      const client = new Colyseus.Client(serverUrl)
      clientRef.current = client

      let room: Colyseus.Room
      if (targetRoomId) {
        room = await client.joinById(targetRoomId, {
          displayName: displayName ?? (spectate ? 'Spectator' : 'Player'),
          spectator: spectate ? true : undefined,
        })
      } else {
        room = await client.create('game', {
          displayName: displayName ?? 'Player',
          manual,
        })
      }

      roomRef.current = room
      store.setRoomId(room.id)
      store.setConnectionStatus('connected')
      setConnected(true)

      // ── Schema state change (Colyseus diff broadcast) ──────────────────
      room.onStateChange((state) => {
        // Track spectator count for "N watching" banner
        const sc = (state as { spectatorCount?: number }).spectatorCount ?? 0
        setSpectatorCount(sc)
        onSpectatorCount?.(sc)

        // Sync summary fields — full card state arrives via 'snapshot' message
        store.applySnapshot({
          roomId:      room.id,
          tick:        (state as { tick?: number }).tick ?? 0,
          players:     [...((state as { players?: Map<string, { seat: number; playerId: string; displayName: string; life: number; connected: boolean }> }).players?.values() ?? [])],
          phase:       (state as { phase?: string }).phase ?? 'main1',
          activePlayer:(state as { activePlayer?: number }).activePlayer ?? 0,
        })

        // Log lines
        const log = (state as { log?: string[] }).log
        if (Array.isArray(log) && log.length) {
          const last = log[log.length - 1]
          if (last) store.pushLogEntry(last)
        }
      })

      // ── Per-seat snapshot (full hidden-info-filtered card state) ───────
      room.onMessage<EngineSnapshot>('snapshot', (snap) => {
        store.setMySeat(snap.viewingSeat)

        // Convert engine snapshot cards → store GameState shape
        const cards: Record<string, import('../types/game').CardInstance> = {}
        for (const [id, c] of Object.entries(snap.estate.game.cards)) {
          cards[id] = {
            instanceId:      c.instanceId,
            cardId:          c.cardId ?? '',
            name:            c.name,
            ownerSeat:       c.ownerSeat,
            controllerSeat:  c.controllerSeat,
            zone:            c.zone as import('../types/game').Zone,
            pos:             c.pos,
            x:               c.x ?? 0,
            y:               c.y ?? 0,
            z:               c.z ?? 0,
            tapped:          c.tapped,
            faceDown:        c.faceDown,
            flipped:         c.flipped,
            phased:          c.phased,
            attacking:       c.attacking,
            counters:        c.counters,
            attachedTo:      c.attachedTo ?? null,
            attachOrder:     null,
            isToken:         c.isToken,
            isCommander:     c.isCommander,
            setCode:         c.setCode ?? null,
            collectorNumber: c.collectorNumber ?? null,
            isFoil:          false,
            isEtched:        false,
            revealedTo:      c.revealedTo,
          }
        }

        store.setGameState({
          seats:       snap.estate.game.seats,
          activeSeat:  snap.estate.game.activeSeat,
          turn:        snap.estate.game.turn,
          phase:       snap.estate.game.phase as import('../types/game').GamePhase,
          players:     snap.estate.game.players.map(p => ({
            seat:       p.seat,
            life:       p.life,
            counters:   p.counters,
            cmdDamage:  p.cmdDamage,
          })),
          cards,
          annotations: snap.estate.game.annotations as Record<string, import('../types/game').AnnotationState>,
        })
      })

      // ── Test echo ──────────────────────────────────────────────────────
      room.onMessage<{ received: unknown; tick: number }>('testAck', (msg) => {
        console.log('[net] testAck', msg)
      })

      // ── Chat (§58) ────────────────────────────────────────────────────
      room.onMessage<{ senderName: string; text: string; isSystem?: boolean }>('chat', (msg) => {
        // Push into log as a chat entry
        store.pushLogEntry(`[chat] ${msg.senderName}: ${msg.text}`)
      })

      // ── Dice/coin roll broadcast (#76) ────────────────────────────────
      room.onMessage<{ seat: number; kind: 'dice' | 'coin'; sides?: number; result: number | string }>(
        'diceRoll',
        (msg) => {
          const label = msg.kind === 'coin'
            ? `Seat ${msg.seat + 1} flipped a coin → ${msg.result}`
            : `Seat ${msg.seat + 1} rolled d${msg.sides ?? '?'} → ${msg.result}`
          store.pushLogEntry(label)
        }
      )

      // ── Game over (#75) ───────────────────────────────────────────────
      // Payload: { winnerSeat, placements: Array<{ seat, userId, displayName, place }> }
      room.onMessage<{
        winnerSeat: number
        placements: Array<{ seat: number; userId: string; displayName: string; place: number }>
      }>('gameOver', (msg) => {
        store.pushLogEntry(`Game over! Seat ${msg.winnerSeat + 1} wins.`)
        store.setGameOver(msg)
      })

      // ── Replay ready (#82) ───────────────────────────────────────────
      // Server broadcasts the full intentLog + player meta after game-over.
      // Client persists to match_replays table via replays.ts.
      room.onMessage<{
        gameId: string
        winnerSeat: number
        players: Array<{ seat: number; userId: string; displayName: string }>
        intentLog: Array<{ seq: number; t: number; seat: number; intent: unknown }>
      }>('replayReady', async (msg) => {
        try {
          const { saveReplay } = await import('./replays')
          await saveReplay({
            game_id: msg.gameId,
            players: msg.players,
            intent_log: msg.intentLog,
            winner_seat: msg.winnerSeat,
          })
          store.pushLogEntry('[replay] Match replay saved.')
        } catch (err) {
          console.warn('[net] replayReady save failed:', err)
        }
      })

      // ── Voice signalling relay (#76) ──────────────────────────────────
      // voiceOffer / voiceAnswer / voiceIce are relayed by the server to the
      // target seat. The voice mesh in voice.ts listens to these directly via
      // the room reference exposed below.

      // ── Disconnect / auto-reconnect (§57) ────────────────────────────
      room.onLeave((code) => {
        console.log('[net] left room, code', code)
        store.setConnectionStatus('disconnected')
        setConnected(false)
        roomRef.current = null
        // Attempt reconnect for normal closes (code < 4000)
        if (code < 4000) {
          store.setConnectionStatus('connecting')
          setTimeout(() => {
            connect().then(() => {
              setJustReconnected(true)
              onReconnected?.()
              if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
              reconnectTimerRef.current = setTimeout(() => setJustReconnected(false), 3500)
            }).catch(() => {})
          }, 1200)
        }
      })

      room.onError((code, message) => {
        console.error('[net] room error', code, message)
        setError(`Room error ${code}: ${message}`)
        store.setConnectionStatus('error')
      })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[net] connect failed:', msg)
      setError(msg)
      store.setConnectionStatus('error')
      setConnected(false)
    }
  }, [targetRoomId, displayName, manual, store])

  // ── Disconnect ──────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    roomRef.current?.leave()
    roomRef.current = null
    clientRef.current = null
    setConnected(false)
    store.setConnectionStatus('disconnected')
  }, [store])

  // ── Auto-connect on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (autoConnect) connect()
    return () => { disconnect() }
  }, [])   // deliberately empty — only run on mount/unmount

  // ── sendIntent ──────────────────────────────────────────────────────────────

  const sendIntent = useCallback((intent: Intent) => {
    const room = roomRef.current
    if (!room) {
      console.warn('[net] sendIntent called but not connected', intent)
      return
    }
    room.send('intent', intent)
  }, [])

  return { connected, room: roomRef.current, sendIntent, connect, disconnect, error, justReconnected, isSpectator: spectate, spectatorCount }
}

// ── Standalone helper: create a room and return its ID (for lobby host) ───────

export async function createRoom(
  serverUrl: string,
  opts: { displayName?: string; manual?: boolean } = {}
): Promise<string> {
  const client = new Colyseus.Client(serverUrl)
  const room   = await client.create('game', {
    displayName: opts.displayName ?? 'Host',
    manual: opts.manual ?? false,
  })
  await room.leave()
  return room.id
}

// ── Standalone helper: just join and send a test intent ───────────────────────

export async function pingRoom(serverUrl: string, roomId: string): Promise<boolean> {
  try {
    const client = new Colyseus.Client(serverUrl)
    const room   = await client.joinById(roomId, { displayName: 'ping' })
    room.send('intent', { type: 'test', payload: 'ping' })
    await new Promise(r => setTimeout(r, 200))
    await room.leave()
    return true
  } catch {
    return false
  }
}

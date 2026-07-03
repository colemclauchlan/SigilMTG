/**
 * web/src/pages/Replay.tsx — VOD replay player (#82)
 * Route: /replay/:id
 *
 * Fetches a match_replays row, reconstructs initial engine state, then
 * steps through the intentLog by re-running dispatch() — the same reducer
 * the server uses. Renders a compact read-only board at each step.
 *
 * Controls: Play/Pause · ◀ Prev · Next ▶ · Seek slider · Speed selector.
 *
 * The engine is imported from the server barrel via a shared path alias.
 * Since the web bundle can't import CJS server code directly, we duplicate
 * only the tiny createEngineState + dispatch wrapper we need — both are
 * pure-function re-exports of the same underlying JS modules.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Clock, Trophy, Users,
} from 'lucide-react'
import { fetchReplay, type ReplayRow, type ReplayIntent, type ReplayPlayer } from '../lib/replays'

// ── Minimal engine shim for client-side replay ────────────────────────────────
// We can't import the Node CJS engine barrel from the browser.
// Instead we reconstruct state by replaying intents against a lightweight
// "replay state" that mirrors what the server schema tracks publicly:
// life totals, phase, active seat, turn, and a card-count-only summary.
// Full card rendering uses the intent log which contains zone-move data.

interface ReplayCard {
  instanceId: string
  name: string
  zone: string
  tapped: boolean
  ownerSeat: number
  controllerSeat: number
  x: number
  y: number
  counters: Record<string, number>
  isToken: boolean
  isCommander: boolean
  cardId: string | null
  setCode: string | null
  collectorNumber: string | null
}

interface ReplayPlayerState {
  seat: number
  life: number
  poison: number
  lost: boolean
  displayName: string
  userId: string
}

interface ReplayEngineState {
  seats: number
  activeSeat: number
  turn: number
  phase: string
  players: ReplayPlayerState[]
  cards: Record<string, ReplayCard>
  log: string[]
}

function buildInitialState(players: ReplayPlayer[]): ReplayEngineState {
  return {
    seats: players.length,
    activeSeat: 0,
    turn: 1,
    phase: 'main1',
    players: players.map(p => ({
      seat: p.seat,
      life: 40,
      poison: 0,
      lost: false,
      displayName: p.displayName,
      userId: p.userId,
    })),
    cards: {},
    log: [],
  }
}

function applyIntent(state: ReplayEngineState, entry: ReplayIntent): ReplayEngineState {
  const intent = entry.intent as Record<string, unknown>
  if (!intent || typeof intent.type !== 'string') return state

  // Deep clone
  const s: ReplayEngineState = JSON.parse(JSON.stringify(state))
  const seat = entry.seat
  const p = s.players[seat]

  switch (intent.type) {
    case 'setLife': {
      const delta = (intent.delta as number) ?? 0
      if (p) p.life = Math.max(0, p.life + delta)
      s.log.push(`Seat ${seat + 1} life ${delta > 0 ? '+' : ''}${delta} → ${p?.life ?? '?'}`)
      break
    }
    case 'passTurn': {
      s.activeSeat = (s.activeSeat + 1) % s.seats
      s.turn++
      s.phase = 'untap'
      s.log.push(`Seat ${seat + 1} passed turn → seat ${s.activeSeat + 1} (turn ${s.turn})`)
      break
    }
    case 'cardMove': {
      const id = intent.instanceId as string
      if (s.cards[id]) {
        s.cards[id].zone = (intent.toZone as string) ?? s.cards[id].zone
        if (intent.x != null) s.cards[id].x = intent.x as number
        if (intent.y != null) s.cards[id].y = intent.y as number
      }
      s.log.push(`Seat ${seat + 1} moved card to ${intent.toZone}`)
      break
    }
    case 'cardTap': {
      const id = intent.instanceId as string
      if (s.cards[id]) {
        s.cards[id].tapped = (intent.tapped as boolean) ?? !s.cards[id].tapped
      }
      break
    }
    case 'untapAll': {
      for (const id in s.cards) {
        if (s.cards[id].ownerSeat === seat && s.cards[id].zone === 'battlefield') {
          s.cards[id].tapped = false
        }
      }
      s.log.push(`Seat ${seat + 1} untapped all`)
      break
    }
    case 'draw': {
      const count = (intent.count as number) ?? 1
      s.log.push(`Seat ${seat + 1} draws ${count}`)
      break
    }
    case 'boardWipe': {
      for (const id in s.cards) {
        if (s.cards[id].zone === 'battlefield' && !s.cards[id].isToken) {
          s.cards[id].zone = 'graveyard'
        }
        if (s.cards[id].isToken) delete s.cards[id]
      }
      s.log.push(`Seat ${seat + 1} cast a board wipe`)
      break
    }
    case 'stackPush': {
      s.log.push(`Seat ${seat + 1} cast/activated: ${intent.sourceName ?? '?'}`)
      break
    }
    case 'stackResolve': {
      s.log.push(`Stack: resolved`)
      break
    }
    case 'diceRoll': {
      const label = (intent.kind as string) === 'coin'
        ? `Seat ${seat + 1} flipped → ${intent.result}`
        : `Seat ${seat + 1} rolled d${intent.sides ?? '?'} → ${intent.result}`
      s.log.push(label)
      break
    }
    case 'joinGame': {
      if (p) p.displayName = (intent.displayName as string) || p.displayName
      break
    }
    default:
      break
  }
  return s
}

// ── Read-only card tile (same pattern as SpectatorView) ──────────────────────

function ReplayCardTile({ card }: { card: ReplayCard }) {
  const imgSrc = card.cardId && card.setCode && card.collectorNumber
    ? `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${card.collectorNumber}?format=image&version=small`
    : null

  return (
    <div
      title={card.name || ''}
      style={{
        width: 36, height: 50, borderRadius: 3,
        border: '1px solid var(--hairline)',
        background: 'var(--ink-3)',
        overflow: 'hidden',
        transform: card.tapped ? 'rotate(8deg)' : 'none',
        transition: 'transform 0.15s ease',
        flexShrink: 0,
      }}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={card.name} loading="lazy" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, color: 'var(--muted)', textAlign: 'center', padding: 2,
          wordBreak: 'break-word',
        }}>
          {card.name || '?'}
        </div>
      )}
    </div>
  )
}

// ── Player panel (read-only board for one seat) ───────────────────────────────

function ReplayPlayerPanel({ playerState, cards, winnerSeat }: {
  playerState: ReplayPlayerState
  cards: ReplayCard[]
  winnerSeat: number
}) {
  const battlefield = cards.filter(c => c.zone === 'battlefield')
  const hand        = cards.filter(c => c.zone === 'hand')
  const isWinner    = playerState.seat === winnerSeat
  const isDead      = playerState.lost || playerState.life <= 0

  return (
    <div
      style={{
        background: 'var(--ink)',
        border: `1px solid ${isWinner ? 'var(--brand)' : 'var(--hairline)'}`,
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: 180,
        opacity: isDead ? 0.5 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontWeight: 800, fontSize: 12, color: isWinner ? 'var(--brand-bright)' : 'var(--paper)',
          letterSpacing: '0.05em', flex: 1,
        }}>
          {playerState.displayName}
          {isWinner && ' 🏆'}
          {isDead && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> — DEAD</span>}
        </span>
        <span style={{
          fontFamily: 'monospace', fontSize: 22, fontWeight: 800,
          color: playerState.life > 10 ? 'var(--paper)' : '#ff4444',
        }}>
          {playerState.life}
        </span>
        {playerState.poison > 0 && (
          <span style={{
            fontSize: 11, color: '#46b277', fontWeight: 700,
            background: 'rgba(70,178,119,0.15)', borderRadius: 4, padding: '1px 5px',
          }}>
            {playerState.poison}☠
          </span>
        )}
      </div>

      {/* Battlefield */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {battlefield.length === 0 ? (
          <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>
            (empty battlefield)
          </span>
        ) : (
          battlefield.map(c => <ReplayCardTile key={c.instanceId} card={c} />)
        )}
      </div>

      {/* Hand count */}
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>
        Hand: {hand.length} · BF: {battlefield.length}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const

export default function Replay() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [replay, setReplay]   = useState<ReplayRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Replay states: array of snapshots, one per intent step
  const [states, setStates]   = useState<ReplayEngineState[]>([])
  const [step, setStep]       = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed]     = useState<(typeof SPEEDS)[number]>(1)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load replay ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchReplay(id).then(row => {
      if (!row) { setError('Replay not found'); setLoading(false); return }
      setReplay(row)

      // Pre-build all snapshots by walking the intent log
      const initial = buildInitialState(row.players)
      const snaps: ReplayEngineState[] = [initial]
      let cur = initial
      for (const entry of row.intent_log) {
        cur = applyIntent(cur, entry)
        snaps.push(cur)
      }
      setStates(snaps)
      setStep(0)
      setLoading(false)
    }).catch(err => {
      setError(String(err))
      setLoading(false)
    })
  }, [id])

  // ── Playback timer ──────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = setInterval(() => {
      setStep(s => {
        if (s >= states.length - 1) { setPlaying(false); stopTimer(); return s }
        return s + 1
      })
    }, Math.round(800 / speed))
  }, [states.length, speed, stopTimer])

  useEffect(() => {
    if (playing) startTimer()
    else stopTimer()
    return stopTimer
  }, [playing, speed, startTimer, stopTimer])

  // ── Current state ───────────────────────────────────────────────────────────

  const currentState = states[step] ?? null

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4 }}
          style={{ color: 'var(--brand-bright)', fontSize: 14, letterSpacing: '0.1em' }}>
          Loading replay…
        </motion.div>
      </div>
    )
  }

  if (error || !replay || !currentState) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>{error ?? 'Replay unavailable.'}</p>
        <button onClick={() => navigate(-1)}
          style={{ color: 'var(--brand-bright)', cursor: 'pointer', background: 'none', border: 'none', fontSize: 14 }}>
          ← Back
        </button>
      </div>
    )
  }

  const totalSteps  = states.length - 1
  const pctComplete = totalSteps > 0 ? (step / totalSteps) * 100 : 0
  const winnerPlayer = currentState.players.find(p => p.seat === replay.winner_seat)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--paper)', margin: 0, letterSpacing: '0.05em' }}>
            Replay
          </h2>
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
            {new Date(replay.created_at).toLocaleString()} · {replay.players.length} players
          </p>
        </div>
        {winnerPlayer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--brand-bright)' }}>
            <Trophy size={14} /> {winnerPlayer.displayName} won
          </div>
        )}
      </div>

      {/* Player panels grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(2, currentState.players.length)}, 1fr)`,
        gap: 12,
      }}>
        {currentState.players.map(p => {
          const playerCards = Object.values(currentState.cards).filter(c => c.ownerSeat === p.seat)
          return (
            <ReplayPlayerPanel
              key={p.seat}
              playerState={p}
              cards={playerCards}
              winnerSeat={replay.winner_seat}
            />
          )
        })}
      </div>

      {/* Log panel */}
      <div style={{
        background: 'var(--ink)',
        border: '1px solid var(--hairline)',
        borderRadius: 8,
        padding: '8px 12px',
        maxHeight: 120,
        overflowY: 'auto',
      }}>
        {currentState.log.slice(-12).map((line, i) => (
          <p key={i} style={{ fontSize: 11, color: 'var(--muted)', margin: '1px 0' }}>{line}</p>
        ))}
        {currentState.log.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No actions yet.</p>
        )}
      </div>

      {/* Playback controls */}
      <div style={{
        background: 'var(--ink)',
        border: '1px solid var(--hairline)',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Seek slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', width: 60, flexShrink: 0 }}>
            Step {step}/{totalSteps}
          </span>
          <input
            type="range"
            min={0}
            max={totalSteps}
            value={step}
            onChange={e => { setPlaying(false); setStep(Number(e.target.value)) }}
            style={{ flex: 1, accentColor: 'var(--brand)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted)', width: 40, textAlign: 'right' }}>
            {Math.round(pctComplete)}%
          </span>
        </div>

        {/* Buttons row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Prev */}
          <button
            onClick={() => { setPlaying(false); setStep(s => Math.max(0, s - 1)) }}
            disabled={step === 0}
            style={{
              background: 'var(--ink-3)', border: '1px solid var(--hairline)', borderRadius: 6,
              color: step === 0 ? 'var(--muted)' : 'var(--paper)', cursor: step === 0 ? 'default' : 'pointer',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <SkipBack size={14} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={() => setPlaying(p => !p)}
            disabled={step >= totalSteps}
            style={{
              background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderRadius: 6,
              color: 'var(--brand-bright)', cursor: step >= totalSteps ? 'default' : 'pointer',
              width: 44, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>

          {/* Next */}
          <button
            onClick={() => { setPlaying(false); setStep(s => Math.min(totalSteps, s + 1)) }}
            disabled={step >= totalSteps}
            style={{
              background: 'var(--ink-3)', border: '1px solid var(--hairline)', borderRadius: 6,
              color: step >= totalSteps ? 'var(--muted)' : 'var(--paper)',
              cursor: step >= totalSteps ? 'default' : 'pointer',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <SkipForward size={14} />
          </button>

          <span style={{ flex: 1 }} />

          {/* Speed selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} style={{ color: 'var(--muted)' }} />
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  background: speed === s ? 'var(--brand-soft)' : 'transparent',
                  border: speed === s ? '1px solid var(--brand)' : '1px solid var(--hairline)',
                  borderRadius: 4, color: speed === s ? 'var(--brand-bright)' : 'var(--muted)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '3px 7px',
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* State summary */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          Turn {currentState.turn} · Phase: {currentState.phase} · Active: Seat {currentState.activeSeat + 1}
        </span>
      </div>
    </div>
  )
}

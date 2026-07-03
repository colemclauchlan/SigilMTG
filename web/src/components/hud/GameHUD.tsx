/**
 * GameHUD — top bar: turn/phase pill, phase buttons, life totals, pass-turn, undo, log.
 * position: fixed, top: 0, full width, z-index: 50.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SkipForward, Undo2, ScrollText, Dice5, Hash, ChevronLeft, RotateCcw, Plus, Maximize, Minimize, HelpCircle, Settings as SettingsIcon } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { GamePhase } from '../../types/game'
import MulliganButton from './MulliganButton'
import DicePopup from './DicePopup'
import TrackersPopup from './TrackersPopup'
import SettingsPopup from './SettingsPopup'
import TermsPanel from '../TermsPanel'
import PlaymatPicker from '../PlaymatPicker'

// ── Phase definitions ─────────────────────────────────────────────────────────

const PHASES: { key: GamePhase; label: string }[] = [
  { key: 'untap',  label: 'Untap'  },
  { key: 'upkeep', label: 'Upkeep' },
  { key: 'draw',   label: 'Draw'   },
  { key: 'main1',  label: 'Main 1' },
  { key: 'combat', label: 'Combat' },
  { key: 'main2',  label: 'Main 2' },
  { key: 'end',    label: 'End'    },
]

// ── Seat color palette (cycles) ───────────────────────────────────────────────

const SEAT_COLORS = [
  '#4da3ff', // blue
  '#e0655c', // red
  '#46b277', // green
  '#eef0ea', // white
  '#9b86c4', // purple
]

function seatColor(seat: number) {
  return SEAT_COLORS[seat % SEAT_COLORS.length]
}

// ── Life popover ──────────────────────────────────────────────────────────────

interface LifePopoverProps {
  seat: number
  life: number
  onAdjust: (delta: number) => void
  onClose: () => void
}

function LifePopover({ seat, life, onAdjust, onClose }: LifePopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-md)',
        padding: '10px 12px',
        zIndex: 60,
        minWidth: 140,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 'var(--fs-200)', color: 'var(--muted)', fontWeight: 600 }}>
        Seat {seat + 1} Life
      </span>
      <span style={{ fontSize: 'var(--fs-700)', fontWeight: 700, color: seatColor(seat), lineHeight: 1 }}>
        {life}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        {([-5, -1, +1, +5] as const).map((delta) => (
          <button
            key={delta}
            onClick={() => onAdjust(delta)}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--hairline)',
              background: delta < 0 ? 'rgba(224,101,92,0.15)' : 'rgba(70,178,119,0.15)',
              color: delta < 0 ? 'var(--danger)' : 'var(--success)',
              fontSize: 'var(--fs-200)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Life pill ─────────────────────────────────────────────────────────────────

function LifePill({ seat, life }: { seat: number; life: number }) {
  const [open, setOpen] = useState(false)
  const { dispatch } = useGameEngine()

  const adjust = (delta: number) => {
    dispatch({ t: 'adjust_life', seat, delta })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          borderRadius: 'var(--r-pill)',
          border: '1px solid var(--hairline)',
          background: 'var(--ink-2)',
          color: 'var(--paper)',
          fontSize: 'var(--fs-200)',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: seatColor(seat),
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        {life}
      </button>
      {open && (
        <LifePopover seat={seat} life={life} onAdjust={adjust} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

// ── Main GameHUD ──────────────────────────────────────────────────────────────

export default function GameHUD() {
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const logOpen = useGameStore((s) => s.ui.logOpen)
  const setUI = useGameStore((s) => s.setUI)
  const { dispatch, undo } = useGameEngine()

  const [diceOpen, setDiceOpen] = useState(false)
  const [trackersOpen, setTrackersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [matPickerOpen, setMatPickerOpen] = useState(false)
  const setPlayMat = useGameStore((s) => s.setPlayMat)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const navigate = useNavigate()
  useEffect(() => { const iv = setInterval(() => setElapsed(Date.now() - startRef.current), 1000); return () => clearInterval(iv) }, [])
  useEffect(() => { const h = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  const toggleFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.() }
  const mmss = `${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}`

  if (!gameState) return null

  const { turn, phase, activeSeat, players } = gameState
  const isMyTurn = activeSeat === mySeat

  const setPhase = (p: GamePhase) => {
    dispatch({ t: 'set_phase', phase: p })
  }

  const passTurn = () => {
    const nextSeat = (activeSeat + 1) % gameState.seats
    dispatch({ t: 'pass_turn', toSeat: nextSeat })
    // Auto: untap all + draw for next player
    dispatch({ t: 'untap_all', seat: nextSeat })
    dispatch({ t: 'draw', seat: nextSeat, count: 1 })
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 44,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        borderBottom: '1px solid var(--hairline)',
        userSelect: 'none',
      }}
    >
      {/* ── Back to lobby ── */}
      <button onClick={() => navigate('/lobby')} title="Back to lobby" style={iconBtnStyle}>
        <ChevronLeft size={16} strokeWidth={2.2} />
      </button>

      {/* ── Turn + phase + timer pill ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--ink-3)',
          border: '1px solid var(--hairline)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 'var(--fs-200)', color: 'var(--muted)', fontWeight: 600 }}>
          Turn {turn}
        </span>
        <span style={{ color: 'var(--hairline)' }}>·</span>
        <span style={{ fontSize: 'var(--fs-200)', color: 'var(--brand)', fontWeight: 700 }}>
          {PHASES.find((p) => p.key === phase)?.label ?? phase}
        </span>
        <span style={{ color: 'var(--hairline)' }}>·</span>
        <span style={{ fontSize: 'var(--fs-100)', color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>{mmss}</span>
      </div>

      {/* ── Active seat indicator ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 'var(--r-pill)',
          background: isMyTurn ? 'rgba(77,163,255,0.12)' : 'transparent',
          border: isMyTurn ? '1px solid rgba(77,163,255,0.3)' : '1px solid transparent',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: seatColor(activeSeat),
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 'var(--fs-100)', color: isMyTurn ? 'var(--brand-bright)' : 'var(--muted)', fontWeight: 600 }}>
          {isMyTurn ? 'Your turn' : `Seat ${activeSeat + 1}'s turn`}
        </span>
      </div>

      {/* ── Phase buttons ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {PHASES.map(({ key, label }) => {
          const active = phase === key
          return (
            <button
              key={key}
              onClick={() => setPhase(key)}
              style={{
                padding: '3px 7px',
                borderRadius: 'var(--r-sm)',
                border: active ? '1px solid rgba(77,163,255,0.5)' : '1px solid transparent',
                background: active ? 'rgba(77,163,255,0.18)' : 'transparent',
                color: active ? 'var(--brand-bright)' : 'var(--faint)',
                fontSize: 'var(--fs-100)',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 120ms, color 120ms',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Life totals ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {players.map((p) => (
          <LifePill key={p.seat} seat={p.seat} life={p.life} />
        ))}
      </div>

      {/* ── Mulligan ── */}
      <MulliganButton />

      {/* ── Pass turn ── */}
      <button
        onClick={passTurn}
        title="Pass turn (auto-draw)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          borderRadius: 'var(--r-sm)',
          border: '1px solid rgba(77,163,255,0.3)',
          background: isMyTurn ? 'rgba(77,163,255,0.18)' : 'var(--ink-2)',
          color: isMyTurn ? 'var(--brand-bright)' : 'var(--muted)',
          fontSize: 'var(--fs-200)',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 140ms',
        }}
      >
        <SkipForward size={12} strokeWidth={2.2} />
        Pass
      </button>

      {/* ── Untap all ── */}
      <button onClick={() => dispatch({ t: 'untap_all', seat: mySeat })} title="Untap all (u)" style={iconBtnStyle}>
        <RotateCcw size={14} strokeWidth={2} />
      </button>

      {/* ── Draw ── */}
      <button onClick={() => dispatch({ t: 'draw', seat: mySeat, count: 1 })} title="Draw a card (d)" style={iconBtnStyle}>
        <Plus size={14} strokeWidth={2} />
      </button>

      {/* ── Undo ── */}
      <button
        onClick={undo}
        title="Undo last action"
        style={iconBtnStyle}
      >
        <Undo2 size={14} strokeWidth={2} />
      </button>

      {/* ── Log toggle ── */}
      <button
        onClick={() => setUI({ logOpen: !logOpen })}
        title="Toggle action log"
        style={{
          ...iconBtnStyle,
          color: logOpen ? 'var(--brand-bright)' : 'var(--faint)',
          background: logOpen ? 'rgba(77,163,255,0.12)' : 'transparent',
        }}
      >
        <ScrollText size={14} strokeWidth={2} />
      </button>

      {/* ── Dice randomizer popup ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setDiceOpen((v) => !v)}
          title="Roll dice / flip coin"
          style={{ ...iconBtnStyle, color: diceOpen ? 'var(--brand-bright)' : 'var(--muted)', background: diceOpen ? 'rgba(77,163,255,0.12)' : 'transparent' }}
        >
          <Dice5 size={14} strokeWidth={2} />
        </button>
        {diceOpen && <DicePopup onClose={() => setDiceOpen(false)} />}
      </div>

      {/* ── Trackers popup ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setTrackersOpen((v) => !v)}
          title="Trackers (counters)"
          style={{ ...iconBtnStyle, color: trackersOpen ? 'var(--brand-bright)' : 'var(--muted)', background: trackersOpen ? 'rgba(77,163,255,0.12)' : 'transparent' }}
        >
          <Hash size={14} strokeWidth={2} />
        </button>
        {trackersOpen && <TrackersPopup onClose={() => setTrackersOpen(false)} />}
      </div>

      {/* ── Fullscreen ── */}
      <button onClick={toggleFullscreen} title="Fullscreen" style={iconBtnStyle}>
        {isFullscreen ? <Minimize size={14} strokeWidth={2} /> : <Maximize size={14} strokeWidth={2} />}
      </button>

      {/* ── Keywords & help ── */}
      <button onClick={() => setHelpOpen((v) => !v)} title="Keywords & help" style={{ ...iconBtnStyle, color: helpOpen ? 'var(--brand-bright)' : 'var(--muted)', background: helpOpen ? 'rgba(77,163,255,0.12)' : 'transparent' }}>
        <HelpCircle size={14} strokeWidth={2} />
      </button>

      {/* ── Settings ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setSettingsOpen((v) => !v)} title="Settings" style={{ ...iconBtnStyle, color: settingsOpen ? 'var(--brand-bright)' : 'var(--muted)', background: settingsOpen ? 'rgba(77,163,255,0.12)' : 'transparent' }}>
          <SettingsIcon size={14} strokeWidth={2} />
        </button>
        {settingsOpen && <SettingsPopup onClose={() => setSettingsOpen(false)} onChangeMat={() => { setSettingsOpen(false); setMatPickerOpen(true) }} />}
      </div>

      {/* ── Keywords/help panel ── */}
      <TermsPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* ── Playmat picker ── */}
      <PlaymatPicker open={matPickerOpen} onClose={() => setMatPickerOpen(false)} onSelect={(mat) => setPlayMat({ type: mat.type, value: mat.value })} />
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 'var(--r-sm)',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
  transition: 'background 120ms, color 120ms',
}

/**
 * Sigil — SpectatorView (/watch/:gameId)
 *
 * Read-only multi-board grid for watching a live Commander game.
 * Layout: 2×2 grid of player panels (scales to seat count) + right-rail
 * for action log and chat (read-only).
 *
 * Architecture:
 *  - Calls useRoom({ roomId, spectate: true }) — no intents ever sent.
 *  - Server sends viewingSeat = -1 on snapshots, signalling spectator mode.
 *  - Each panel shows: player name, life total, commander-damage indicators,
 *    and their public battlefield cards (scaled-down, no drag/tap).
 *  - "LIVE · N watching" banner at top.
 *  - Chat rail is read-only (no input).
 */
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, ArrowLeft, MessageSquare, Scroll, Shield } from 'lucide-react'
import { useRoom } from '../lib/net'
import type { EngineSnapshot, CardSnapshot } from '../lib/net'
import { useGameStore } from '../store/gameStore'

// ── Compact card tile (read-only, no interaction) ────────────────────────────

interface CardTileProps {
  card: CardSnapshot
}

function CardTile({ card }: CardTileProps) {
  const [hovered, setHovered] = useState(false)

  // For hidden cards (hand/library, identity stripped) show a back
  const isHidden = !card.name && !card.cardId

  const imgSrc = card.cardId && card.setCode && card.collectorNumber
    ? `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${card.collectorNumber}?format=image&version=small`
    : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={card.name || (isHidden ? '(hidden)' : '')}
      className="relative flex-shrink-0"
      style={{
        width: 36,
        height: 50,
        borderRadius: 3,
        border: '1px solid var(--hairline)',
        background: isHidden ? 'var(--ink)' : 'var(--ink-3)',
        overflow: 'hidden',
        transform: card.tapped ? 'rotate(8deg)' : 'none',
        transition: 'transform 0.15s ease',
        boxShadow: hovered ? '0 0 8px var(--brand)' : 'none',
        cursor: 'default',
      }}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={card.name}
          loading="lazy"
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : isHidden ? (
        // Card back pattern
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'repeating-linear-gradient(45deg, var(--ink-3), var(--ink-3) 3px, var(--ink) 3px, var(--ink) 6px)',
          }}
        />
      ) : (
        <div
          className="flex items-center justify-center h-full text-[8px] text-center p-0.5"
          style={{ color: 'var(--muted)', wordBreak: 'break-word' }}
        >
          {card.name}
        </div>
      )}

      {/* Counter badge */}
      {Object.keys(card.counters).length > 0 && (
        <div
          className="absolute bottom-0 right-0 text-[7px] font-bold px-0.5"
          style={{ background: 'rgba(0,0,0,0.75)', color: '#7fc97f', borderRadius: '2px 0 0 0' }}
        >
          {Object.entries(card.counters)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => `${v > 0 ? '+' : ''}${v}${k === '+1/+1' ? '' : k[0]}`)
            .join(' ')}
        </div>
      )}
    </div>
  )
}

// ── Zone strip (battlefield / graveyard / exile etc.) ────────────────────────

interface ZoneStripProps {
  label: string
  color: string
  cards: CardSnapshot[]
}

function ZoneStrip({ label, color, cards }: ZoneStripProps) {
  if (cards.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
        {label} ({cards.length})
      </p>
      <div className="flex flex-wrap gap-1">
        {cards.map(c => <CardTile key={c.instanceId} card={c} />)}
      </div>
    </div>
  )
}

// ── Player panel (one seat in the 2×2 grid) ──────────────────────────────────

interface PlayerInfo {
  seat: number
  displayName: string
  life: number
  counters: Record<string, number>
  cmdDamage: Record<string, number>
  handCount: number
  libraryCount: number
}

interface PlayerPanelProps {
  player: PlayerInfo
  cards: CardSnapshot[]
  isActive: boolean
}

function PlayerPanel({ player, cards, isActive }: PlayerPanelProps) {
  const battlefield = cards.filter(c => c.ownerSeat === player.seat && c.zone === 'battlefield')
  const graveyard   = cards.filter(c => c.ownerSeat === player.seat && c.zone === 'graveyard')
  const exile       = cards.filter(c => c.ownerSeat === player.seat && c.zone === 'exile')
  const command     = cards.filter(c => c.ownerSeat === player.seat && c.zone === 'command')
  const poison      = player.counters['poison'] ?? 0

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg overflow-hidden min-h-0"
      style={{
        border: isActive
          ? '1.5px solid var(--brand)'
          : '1px solid var(--hairline)',
        background: 'var(--ink-3)',
        boxShadow: isActive ? '0 0 12px rgba(77,163,255,0.18)' : 'none',
        transition: 'box-shadow 0.3s',
      }}
    >
      {/* Header: name + life */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isActive && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--brand-bright)' }}
            />
          )}
          <p
            className="text-xs font-bold truncate"
            style={{ color: isActive ? 'var(--brand-bright)' : 'var(--paper)' }}
          >
            {player.displayName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {poison >= 10 && (
            <span className="text-[9px] font-bold px-1 rounded" style={{ background: '#1a3a1a', color: '#7fc97f' }}>
              ☠ {poison}P
            </span>
          )}
          {poison > 0 && poison < 10 && (
            <span className="text-[9px] font-bold" style={{ color: '#7fc97f' }}>
              {poison}P
            </span>
          )}
          <span
            className="font-display font-bold text-lg tabular-nums leading-none"
            style={{ color: player.life <= 5 ? '#e07b54' : player.life <= 0 ? '#c94040' : 'var(--paper)' }}
          >
            {player.life}
          </span>
        </div>
      </div>

      {/* Commander damage indicators */}
      {Object.keys(player.cmdDamage).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(player.cmdDamage)
            .filter(([, dmg]) => (dmg as number) > 0)
            .map(([cmdId, dmg]) => (
              <span
                key={cmdId}
                className="text-[9px] font-bold px-1 py-0.5 rounded"
                style={{ background: 'rgba(224,123,84,0.15)', color: '#e07b54', border: '1px solid rgba(224,123,84,0.3)' }}
              >
                {cmdId.slice(-4)} {dmg}
              </span>
            ))}
        </div>
      )}

      {/* Hand/Library counts */}
      <div className="flex items-center gap-3 text-[9px]" style={{ color: 'var(--muted)' }}>
        <span>Hand: {player.handCount}</span>
        <span>Library: {player.libraryCount}</span>
        {command.length > 0 && <span>Command: {command.length}</span>}
      </div>

      {/* Zones */}
      <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 200 }}>
        <ZoneStrip label="Battlefield" color="var(--brand)" cards={battlefield} />
        <ZoneStrip label="Graveyard"   color="#e07b54"      cards={graveyard} />
        <ZoneStrip label="Exile"       color="#a78bfa"      cards={exile} />
      </div>
    </div>
  )
}

// ── Chat / Log rail ──────────────────────────────────────────────────────────

interface RailProps {
  log: string[]
}

function SideRail({ log }: RailProps) {
  const [tab, setTab] = useState<'log' | 'chat'>('log')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  const chatLines = log.filter(l => l.startsWith('[chat]'))
  const logLines  = log.filter(l => !l.startsWith('[chat]'))
  const lines     = tab === 'chat' ? chatLines : logLines

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        border: '1px solid var(--hairline)',
        background: 'var(--ink-3)',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Tab bar */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--hairline)', flexShrink: 0 }}
      >
        {(['log', 'chat'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors"
            style={{
              color: tab === t ? 'var(--brand-bright)' : 'var(--muted)',
              background: tab === t ? 'var(--ink)' : 'transparent',
              borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
            }}
          >
            {t === 'log' ? <><Scroll size={10} /> Log</> : <><MessageSquare size={10} /> Chat</>}
          </button>
        ))}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5" style={{ minHeight: 0 }}>
        {lines.length === 0 ? (
          <p className="text-[10px] text-center py-4" style={{ color: 'var(--faint)' }}>
            {tab === 'chat' ? 'No chat yet' : 'No actions yet'}
          </p>
        ) : (
          lines.map((line, i) => {
            const isChat = line.startsWith('[chat]')
            return (
              <p
                key={i}
                className="text-[10px] leading-relaxed"
                style={{ color: isChat ? 'var(--paper-dim)' : 'var(--muted)' }}
              >
                {line.replace(/^\[chat\] /, '')}
              </p>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Read-only notice */}
      <div
        className="flex items-center justify-center gap-1.5 py-2 text-[9px] font-bold tracking-widest uppercase border-t"
        style={{
          borderColor: 'var(--hairline)',
          color: 'var(--faint)',
          flexShrink: 0,
        }}
      >
        <Eye size={9} /> Read only
      </div>
    </div>
  )
}

// ── Main SpectatorView ────────────────────────────────────────────────────────

export default function SpectatorView() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate   = useNavigate()

  const [log, setLog]         = useState<string[]>([])
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null)
  const [playerMeta, setPlayerMeta] = useState<Record<number, { displayName: string; handCount: number; libraryCount: number }>>({})

  const { connected, error, spectatorCount } = useRoom({
    roomId: gameId,
    spectate: true,
    autoConnect: true,
    onSpectatorCount: () => {},
  })

  // Read game state from Zustand store — net.ts writes snapshot + log here
  const gameState   = useGameStore((s: { gameState: import('../types/game').GameState | null }) => s.gameState)
  const logEntries  = useGameStore((s: { logEntries: import('../types/game').LogEntry[] }) => s.logEntries)

  // Build player metadata from schema state (life/handCount/libCount come through schema,
  // but displayName needs the schema players map — we read it from snapshot estate.game.players)
  useEffect(() => {
    if (!gameState) return
    const meta: Record<number, { displayName: string; handCount: number; libraryCount: number }> = {}
    for (let seat = 0; seat < (gameState.seats ?? 0); seat++) {
      const ep = gameState.players.find(p => p.seat === seat)
      if (!ep) continue
      // Count hand/library for this seat from cards
      let hand = 0, library = 0
      for (const c of Object.values(gameState.cards)) {
        if (c.ownerSeat !== seat) continue
        if (c.zone === 'hand') hand++
        if (c.zone === 'library') library++
      }
      meta[seat] = {
        displayName: `Player ${seat + 1}`,  // server schema has displayName in PlayerState
        handCount:   hand,
        libraryCount: library,
      }
    }
    setPlayerMeta(meta)
  }, [gameState])

  // Sync log — logEntries are LogEntry objects with .html field
  useEffect(() => {
    if (logEntries?.length) {
      setLog(logEntries.map(e => {
        // Strip basic HTML tags for plain text display
        return e.html.replace(/<[^>]+>/g, '')
      }))
    }
  }, [logEntries])

  // Build seat list from snapshot
  const seats = gameState ? Array.from({ length: gameState.seats ?? 0 }, (_, i) => i) : []
  // Cast CardInstance to CardSnapshot — the shapes are compatible for our read-only use
  const allCards = gameState ? (Object.values(gameState.cards) as unknown as CardSnapshot[]) : []
  const activeSeat = gameState?.activeSeat ?? 0
  // seats count comes from GameState.seats number

  // Grid layout: 1 col for ≤2 players, 2×2 for 3–4
  const cols = seats.length <= 2 ? 1 : 2

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
        <Shield size={36} style={{ color: 'var(--faint)' }} />
        <p className="font-bold" style={{ color: 'var(--paper)' }}>Could not join spectator session</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
        <button
          onClick={() => navigate('/watch')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold"
          style={{ borderRadius: 'var(--r-md)', background: 'var(--ink-3)', color: 'var(--paper)', border: '1px solid var(--hairline)' }}
        >
          <ArrowLeft size={14} /> Back to Watch
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--bg)' }}>

      {/* ── LIVE banner ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-1.5 text-xs font-bold"
        style={{
          background: 'rgba(77,163,255,0.10)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(77,163,255,0.25)',
          color: 'var(--brand-bright)',
        }}
      >
        <button
          onClick={() => navigate('/watch')}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft size={13} /> Watch
        </button>

        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff5050] animate-pulse" />
              <span style={{ color: '#ff5050' }}>LIVE</span>
              {spectatorCount > 0 && (
                <span style={{ color: 'var(--muted)' }}>· {spectatorCount} watching</span>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--muted)' }}>Connecting…</span>
          )}
        </div>

        <div className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          <Eye size={12} />
          Spectating — read only
        </div>
      </div>

      {/* ── Main content: grid + rail ─────────────────────────────────────── */}
      <div className="flex flex-1 gap-3 p-3 overflow-hidden" style={{ minHeight: 0 }}>

        {/* Player grid */}
        <div
          className="flex-1 overflow-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 12,
            alignContent: 'start',
          }}
        >
          <AnimatePresence>
            {seats.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-2 flex flex-col items-center justify-center py-20 gap-3"
                style={{ gridColumn: '1 / -1' }}
              >
                <Eye size={32} style={{ color: 'var(--faint)' }} />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {connected ? 'Waiting for game state…' : 'Connecting…'}
                </p>
              </motion.div>
            ) : (
              seats.map(seat => {
                const ep = gameState!.players.find(p => p.seat === seat)
                if (!ep) return null
                const meta = playerMeta[seat]
                const playerInfo: PlayerInfo = {
                  seat,
                  displayName: meta?.displayName ?? `Player ${seat + 1}`,
                  life:        ep?.life ?? 40,
                  counters:    ep?.counters ?? {},
                  cmdDamage:   ep?.cmdDamage ?? {},
                  handCount:   meta?.handCount ?? 0,
                  libraryCount: meta?.libraryCount ?? 0,
                }
                return (
                  <motion.div
                    key={seat}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: seat * 0.06 }}
                  >
                    <PlayerPanel
                      player={playerInfo}
                      cards={allCards}
                      isActive={seat === activeSeat}
                    />
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </div>

        {/* Side rail: log + chat */}
        <div className="flex-shrink-0" style={{ width: 220 }}>
          <SideRail log={log} />
        </div>
      </div>
    </div>
  )
}

/**
 * Sigil — MOBA-style draft-select screen (§55)
 *
 * Each seat shows:
 *  - Player name + avatar initial
 *  - Bracket circle (B1–B5) with U/L prefix, color-coded
 *  - Chosen deck name (if picked)
 *  - "Lock In" button for the local player
 *
 * Opponents see each other's bracket before locking in.
 * Uses framer-motion for pick-screen feel.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Swords, Crown } from 'lucide-react'
import type { BracketResult } from '../../lib/bracket'

const BRACKET_COLORS: Record<number, string> = {
  1: '#a3cfbb',
  2: '#7ec8e3',
  3: '#f7c59f',
  4: '#e07b54',
  5: '#c94040',
}
const BRACKET_NAMES: Record<number, string> = {
  1: 'Exhibition',
  2: 'Core',
  3: 'Upgraded',
  4: 'Optimized',
  5: 'cEDH',
}

export interface SeatInfo {
  seat: number
  displayName: string
  isLocal: boolean
  isHost: boolean
  connected: boolean
  deckName?: string
  bracketResult?: BracketResult
  lockedIn: boolean
}

interface Props {
  seats: SeatInfo[]
  totalSeats: number
  isSpectator?: boolean
  onSelectDeck: () => void   // opens deck picker
  onLockIn: () => void
  onStartGame: () => void    // host only
  localDeckName?: string
  localBracket?: BracketResult
}

function BracketCircle({ result, small }: { result: BracketResult; small?: boolean }) {
  const color = BRACKET_COLORS[result.bracket]
  const size = small ? 36 : 56

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="flex items-center justify-center flex-shrink-0 font-bold"
      style={{
        width: size, height: size,
        borderRadius: '50%',
        border: `${small ? 2 : 3}px solid ${color}`,
        background: `${color}18`,
        color,
        fontSize: small ? '0.7rem' : '0.9rem',
        fontFamily: 'var(--font-display)',
        flexDirection: 'column',
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: small ? '0.6rem' : '0.7rem', opacity: 0.8 }}>
        {result.subRating ?? ''}
      </span>
      <span>B{result.bracket}</span>
    </motion.div>
  )
}

export default function DraftSelect({
  seats,
  totalSeats,
  isSpectator,
  onSelectDeck,
  onLockIn,
  onStartGame,
  localDeckName,
  localBracket,
}: Props) {
  const [allLockedIn, setAllLockedIn] = useState(false)
  const filledSeats = seats.filter((s) => s.connected)
  const localSeat   = seats.find((s) => s.isLocal)

  useEffect(() => {
    const connected = seats.filter((s) => s.connected)
    if (connected.length > 0 && connected.length === totalSeats) {
      setAllLockedIn(connected.every((s) => s.lockedIn))
    }
  }, [seats, totalSeats])

  // Empty slot placeholder
  const emptySlots = Array.from({ length: totalSeats - filledSeats.length }, (_, i) => i)

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #04101f 0%, #081828 60%, #0c2040 100%)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <div className="flex items-center gap-3">
          <Swords size={20} color="var(--brand-bright)" />
          <span className="font-display font-bold text-lg tracking-widest uppercase" style={{ color: 'var(--paper)' }}>
            Draft Select
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {filledSeats.length}/{totalSeats} players
        </span>
      </div>

      {/* Seats grid */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className={`grid gap-4 w-full max-w-4xl`}
          style={{ gridTemplateColumns: `repeat(${Math.min(totalSeats, 4)}, 1fr)` }}
        >
          {/* Filled seats */}
          {seats.map((seat) => (
            <motion.div
              key={seat.seat}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: seat.seat * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-4 p-5"
              style={{
                borderRadius: 'var(--r-lg)',
                border: `1px solid ${seat.lockedIn ? 'var(--success)' : seat.isLocal ? 'var(--brand)' : 'var(--hairline)'}`,
                background: seat.isLocal
                  ? 'linear-gradient(180deg, rgba(77,163,255,0.06) 0%, transparent 100%)'
                  : 'var(--glass)',
                backdropFilter: 'blur(12px)',
                transition: 'border-color 400ms',
                minHeight: 280,
              }}
            >
              {/* Avatar */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-display font-bold relative"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand-bright)' }}
              >
                {seat.displayName[0]?.toUpperCase()}
                {seat.isHost && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: '#f7c948' }}>
                    <Crown size={10} color="#04101f" />
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="text-center">
                <p className="font-bold text-sm" style={{ color: 'var(--paper)' }}>
                  {seat.displayName}
                  {seat.isLocal && <span style={{ color: 'var(--brand-bright)' }}> (you)</span>}
                </p>
              </div>

              {/* Bracket circle — visible to all (core P55 feature) */}
              <AnimatePresence>
                {seat.bracketResult ? (
                  <BracketCircle result={seat.bracketResult} />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ border: '2px dashed var(--hairline)', color: 'var(--faint)', fontSize: '0.7rem' }}
                  >
                    B?
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Deck name */}
              <p className="text-xs text-center truncate w-full" style={{ color: 'var(--muted)' }}>
                {seat.deckName ?? '— no deck —'}
              </p>

              {/* Lock-in status / actions */}
              {seat.isLocal && !isSpectator ? (
                <div className="flex flex-col gap-2 w-full mt-auto">
                  <button
                    onClick={onSelectDeck}
                    disabled={seat.lockedIn}
                    className="w-full py-2 text-xs font-bold tracking-wide disabled:opacity-40"
                    style={{
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--brand)',
                      color: 'var(--brand-bright)',
                    }}
                  >
                    {seat.deckName ? 'Change Deck' : 'Select Deck'}
                  </button>
                  <button
                    onClick={onLockIn}
                    disabled={seat.lockedIn || !seat.deckName}
                    className="w-full py-2 text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderRadius: 'var(--r-sm)',
                      background: seat.lockedIn ? 'var(--ink-3)' : 'linear-gradient(135deg, var(--brand-bright), var(--brand))',
                      color: seat.lockedIn ? 'var(--success)' : '#04101f',
                    }}
                  >
                    {seat.lockedIn ? <><Check size={12} /> Locked In</> : 'Lock In'}
                  </button>
                </div>
              ) : (
                <div className="mt-auto">
                  {seat.lockedIn ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-1.5 text-xs font-bold"
                      style={{ color: 'var(--success)' }}
                    >
                      <Check size={12} /> Ready
                    </motion.div>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--faint)' }}>Picking…</span>
                  )}
                </div>
              )}
            </motion.div>
          ))}

          {/* Empty seat placeholders */}
          {emptySlots.map((i) => (
            <motion.div
              key={`empty-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              className="flex flex-col items-center justify-center gap-3 p-5"
              style={{
                borderRadius: 'var(--r-lg)',
                border: '1px dashed var(--hairline)',
                minHeight: 280,
              }}
            >
              <div className="w-14 h-14 rounded-full" style={{ background: 'var(--ink-3)' }} />
              <span className="text-xs" style={{ color: 'var(--faint)' }}>Waiting…</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer — host can start when all locked in */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderTop: '1px solid var(--hairline)' }}
      >
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          {allLockedIn
            ? 'All players ready!'
            : `Waiting for ${seats.filter((s) => s.connected && !s.lockedIn).length} player(s)…`}
        </div>
        {localSeat?.isHost && !isSpectator && (
          <button
            onClick={onStartGame}
            disabled={!allLockedIn}
            className="px-6 py-2.5 font-bold text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderRadius: 'var(--r-md)',
              background: allLockedIn
                ? 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))'
                : 'var(--ink-3)',
              color: allLockedIn ? '#04101f' : 'var(--faint)',
              transition: 'all 300ms',
            }}
          >
            Start Game
          </button>
        )}
        {isSpectator && (
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
            Spectating
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * HealthCluster — bottom-left life + poison + commander-damage cluster (§5 #42–50).
 *
 * §42  Buttons appear + animate-spread on hover of the health bar.
 * §43  Only "Types" + skull shown (no Heal/Damage/Drain/Extort).
 * §44  Types modal → Normal | Poison | Cmdr (portrait picker) | Lifelink | Apply.
 * §45  Cmdr works solo (shows "no opponents" hint but still opens).
 * §46  21 from one commander = death; cmdr damage reduces life.
 * §47  Poison → green counters; 10 = death.
 * §48  0 life → board greys + DEAD! overlay.
 * §49  Per-commander damage icons (yellow circle w/ art) next to life total.
 * §50  + hovers green, − hovers red everywhere (Stepper component).
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Skull } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import Stepper from './Stepper'
import TypesModal from './TypesModal'
import CmdrDamageIcons from './CmdrDamageIcons'
import DeadOverlay from './DeadOverlay'

interface HealthClusterProps {
  mySeat: number
}

// Spread animation for the action buttons (§42)
const spreadVariants = {
  hidden: { opacity: 0, x: 0, scale: 0.6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: i * 0.04,
      type: 'spring',
      stiffness: 420,
      damping: 22,
    },
  }),
  exit: (i: number) => ({
    opacity: 0,
    scale: 0.5,
    transition: { delay: i * 0.02, duration: 0.1 },
  }),
}

export default function HealthCluster({ mySeat }: HealthClusterProps) {
  const gameState    = useGameStore((s) => s.gameState)
  const setGameState = useGameStore((s) => s.setGameState)
  const pushLogEntry = useGameStore((s) => s.pushLogEntry)

  const [hovered, setHovered]         = useState(false)
  const [typesOpen, setTypesOpen]     = useState(false)
  const [deadDismissed, setDeadDismissed] = useState(false)
  const [skullArmed, setSkullArmed]   = useState(false)

  // Null-safe derivations so the hooks below run unconditionally (Rules of Hooks).
  const player = gameState?.players?.[mySeat]
  const playerName = player?.name ?? `Seat ${mySeat + 1}`

  // ── Life adjustments ─────────────────────────────────────────
  const adjustLife = useCallback((delta: number) => {
    if (!gameState) return
    const next = JSON.parse(JSON.stringify(gameState)) as typeof gameState
    next.players[mySeat].life += delta
    setGameState(next)
    pushLogEntry(
      `<b>${playerName}</b> ${delta > 0 ? 'gained' : 'lost'} <b>${Math.abs(delta)}</b> life (${next.players[mySeat].life} total)`
    )
  }, [gameState, mySeat, playerName, setGameState, pushLogEntry])

  // ── Skull (set life to 0) ─────────────────────────────────────
  const handleSkull = useCallback(() => {
    if (!skullArmed) {
      setSkullArmed(true)
      setTimeout(() => setSkullArmed(false), 1600)
      return
    }
    setSkullArmed(false)
    if (!gameState) return
    const next = JSON.parse(JSON.stringify(gameState)) as typeof gameState
    next.players[mySeat].life = 0
    setGameState(next)
    pushLogEntry(`<b>${playerName}</b> set life to 0 (skull)`)
  }, [skullArmed, gameState, mySeat, playerName, setGameState, pushLogEntry])

  // Early returns AFTER every hook (fixes React #310 in solo mode).
  if (!gameState || !player) return null

  const life     = player.life
  const poison   = player.counters?.['poison'] ?? 0
  const isDead   = life <= 0
  const showDead = isDead && !deadDismissed

  // ── Life color ────────────────────────────────────────────────
  function lifeColor(life: number): string {
    if (life <= 0) return 'var(--danger)'
    if (life <= 5) return '#e0655c'
    if (life <= 10) return '#eab251'
    return 'var(--paper)'
  }

  // ── Pill container ────────────────────────────────────────────
  return (
    <>
      {/* Dead overlay (§48) */}
      <AnimatePresence>
        {showDead && (
          <DeadOverlay
            key="dead"
            playerName={playerName}
            onDismiss={() => setDeadDismissed(true)}
          />
        )}
      </AnimatePresence>

      {/* Main cluster — fixed bottom-left */}
      <div
        style={{
          position: 'fixed',
          bottom: 100,   // above the hand zone
          left: 12,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 6,
          userSelect: 'none',
        }}
      >
        {/* Spread action buttons (§42 — appear on hover) */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              style={{ display: 'flex', gap: 6, alignItems: 'center' }}
            >
              {/* Types button (§43) */}
              <motion.button
                custom={0}
                variants={spreadVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={() => setTypesOpen(true)}
                title="Types (Normal / Poison / Cmdr)"
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--hairline)',
                  background: 'var(--glass-strong)',
                  backdropFilter: 'blur(12px)',
                  color: 'var(--paper)',
                  fontSize: 'var(--fs-200)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'border-color 130ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(77,163,255,0.45)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hairline)' }}
              >
                Types
              </motion.button>

              {/* Skull button (§43 — sets life to 0) */}
              <motion.button
                custom={1}
                variants={spreadVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={handleSkull}
                title={skullArmed ? 'Confirm: set life to 0' : 'Set my life to 0'}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--r-sm)',
                  border: `1px solid ${skullArmed ? 'var(--danger)' : 'var(--hairline)'}`,
                  background: skullArmed ? 'rgba(224,101,92,0.18)' : 'var(--glass-strong)',
                  backdropFilter: 'blur(12px)',
                  color: skullArmed ? 'var(--danger)' : 'var(--muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 130ms',
                }}
              >
                <Skull size={15} strokeWidth={2} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Life pill row — always visible */}
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 8px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--glass-strong)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${isDead ? 'var(--danger)' : 'var(--hairline)'}`,
            boxShadow: isDead ? '0 0 18px rgba(224,101,92,0.28)' : 'var(--shadow-sm)',
            transition: 'border-color 200ms, box-shadow 200ms',
          }}
        >
          {/* − button (§50 — hover red) */}
          <Stepper sign="-" onClick={() => adjustLife(-1)} size={28} title="Lose 1 life" />

          {/* Life total */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 46 }}>
            {/* Commander damage icons (§49) */}
            <CmdrDamageIcons mySeat={mySeat} />

            <span
              style={{
                fontSize: 'clamp(1.4rem, 2vw, 2rem)',
                fontWeight: 800,
                color: lifeColor(life),
                lineHeight: 1,
                fontFamily: 'var(--font-display)',
                transition: 'color 300ms',
              }}
            >
              {life}
            </span>

            {/* Poison counter (§47 — green badge) */}
            {poison > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  marginTop: 2,
                  padding: '1px 5px',
                  borderRadius: 'var(--r-pill)',
                  background: 'rgba(70,178,119,0.18)',
                  border: `1px solid ${poison >= 10 ? 'var(--danger)' : 'rgba(70,178,119,0.5)'}`,
                }}
              >
                <span style={{ fontSize: 10 }}>☣</span>
                <span
                  style={{
                    fontSize: 'var(--fs-100)',
                    fontWeight: 700,
                    color: poison >= 10 ? 'var(--danger)' : 'var(--success)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {poison}
                </span>
              </div>
            )}
          </div>

          {/* + button (§50 — hover green) */}
          <Stepper sign="+" onClick={() => adjustLife(1)} size={28} title="Gain 1 life" />
        </div>
      </div>

      {/* Types modal (§44) */}
      <AnimatePresence>
        {typesOpen && (
          <TypesModal
            key="types-modal"
            mySeat={mySeat}
            onClose={() => setTypesOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

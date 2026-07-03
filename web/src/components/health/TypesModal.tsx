/**
 * TypesModal — commander-damage / poison type-select modal (§5 #44–47).
 * Opens from HealthCluster. Covers:
 *   Normal | Poison/Infect | Cmdr (→ circle portrait picker) | Lifelink | Apply
 * Solo: Cmdr section shows "No opponents" hint but still opens.
 * Logic: 21 cmdr damage from one source = death; 10 poison = death; 0 life = death.
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import Stepper from './Stepper'

interface TypesModalProps {
  mySeat: number
  onClose: () => void
}

type DamageType = 'normal' | 'poison' | 'cmdr'

export default function TypesModal({ mySeat, onClose }: TypesModalProps) {
  const gameState = useGameStore((s) => s.gameState)
  const setGameState = useGameStore((s) => s.setGameState)
  const pushLogEntry = useGameStore((s) => s.pushLogEntry)
  const imagesById = useGameStore((s) => s.imagesById)

  const [damageType, setDamageType] = useState<DamageType>('normal')
  const [lifelink, setLifelink] = useState(false)
  const [amount, setAmount] = useState(1)
  const [sourceSeat, setSourceSeat] = useState<number | null>(null)

  const ref = useRef<HTMLDivElement>(null)

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (!gameState) return null

  const me = gameState.players[mySeat]
  const opponents = gameState.players.filter((p) => p.seat !== mySeat)

  // Default source to first opponent on mount
  useEffect(() => {
    if (opponents.length > 0 && sourceSeat === null) {
      setSourceSeat(opponents[0].seat)
    }
  }, [opponents.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Find commander card for a seat (first isCommander card in command zone)
  function cmdPortrait(seat: number): string | null {
    if (!gameState) return null
    const cards = Object.values(gameState.cards)
    const cmdCard = cards.find(
      (c) => c.ownerSeat === seat && c.isCommander && c.zone === 'command'
    )
    if (!cmdCard) return null
    return imagesById[cmdCard.name]?.img ?? cmdCard.imageUri ?? null
  }

  function playerName(seat: number) {
    return gameState?.players[seat]?.name ?? `Seat ${seat + 1}`
  }

  function apply() {
    if (!gameState) return
    const next = JSON.parse(JSON.stringify(gameState)) as typeof gameState
    const player = next.players[mySeat]

    if (damageType === 'poison') {
      // Add poison counters
      player.counters = player.counters ?? {}
      player.counters['poison'] = (player.counters['poison'] ?? 0) + amount
      pushLogEntry(
        `<b>${playerName(mySeat)}</b> took <b>${amount}</b> poison counter${amount !== 1 ? 's' : ''} (total: <b>${player.counters['poison']}</b>)`
      )
      // 10 poison = death
      if (player.counters['poison'] >= 10) {
        player.life = 0
        pushLogEntry(`<b>${playerName(mySeat)}</b> has 10 poison counters — <b style="color:var(--danger)">DEAD</b>`)
      }
    } else if (damageType === 'cmdr' && sourceSeat !== null) {
      // Commander damage
      const key = String(sourceSeat)
      player.cmdDamage = player.cmdDamage ?? {}
      player.cmdDamage[key] = (player.cmdDamage[key] ?? 0) + amount
      // Reduces life
      player.life -= amount
      pushLogEntry(
        `<b>${playerName(mySeat)}</b> took <b>${amount}</b> commander damage from <b>${playerName(sourceSeat)}</b> (total: <b>${player.cmdDamage[key]}</b>)`
      )
      // 21 from one commander = death
      if (player.cmdDamage[key] >= 21) {
        player.life = 0
        pushLogEntry(`<b>${playerName(mySeat)}</b> has 21 commander damage from <b>${playerName(sourceSeat)}</b> — <b style="color:var(--danger)">DEAD</b>`)
      }
      // Lifelink: source player gains life
      if (lifelink && sourceSeat !== null) {
        next.players[sourceSeat].life += amount
        pushLogEntry(`<b>${playerName(sourceSeat)}</b> gained <b>${amount}</b> life (lifelink)`)
      }
    } else {
      // Normal damage
      player.life -= amount
      pushLogEntry(`<b>${playerName(mySeat)}</b> took <b>${amount}</b> damage`)
      if (lifelink && sourceSeat !== null) {
        next.players[sourceSeat].life += amount
        pushLogEntry(`<b>${playerName(sourceSeat)}</b> gained <b>${amount}</b> life (lifelink)`)
      }
    }

    setGameState(next)
    onClose()
  }

  const seg: React.CSSProperties = {
    display: 'flex',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--hairline)',
    overflow: 'hidden',
    background: 'var(--ink-3)',
  }

  function segBtn(active: boolean, onClick: () => void, label: string) {
    return (
      <button
        key={label}
        onClick={onClick}
        style={{
          flex: 1,
          padding: '6px 10px',
          border: 'none',
          background: active ? 'var(--brand-soft)' : 'transparent',
          color: active ? 'var(--brand-bright)' : 'var(--muted)',
          fontSize: 'var(--fs-200)',
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
          transition: 'background 130ms, color 130ms',
          fontFamily: 'var(--font-body)',
        }}
      >
        {label}
      </button>
    )
  }

  function togBtn(active: boolean, onClick: () => void, label: string, color?: string) {
    return (
      <button
        onClick={onClick}
        style={{
          padding: '6px 14px',
          borderRadius: 'var(--r-sm)',
          border: `1px solid ${active ? (color ?? 'rgba(77,163,255,0.4)') : 'var(--hairline)'}`,
          background: active ? (color ? `${color}22` : 'var(--brand-soft)') : 'var(--ink-3)',
          color: active ? (color ?? 'var(--brand-bright)') : 'var(--muted)',
          fontSize: 'var(--fs-200)',
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
          transition: 'all 130ms',
          fontFamily: 'var(--font-body)',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        padding: '0 0 110px 12px',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        ref={ref}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        style={{
          background: 'var(--glass-strong)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '18px 18px 20px',
          width: 300,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--fs-300)', fontWeight: 700, color: 'var(--paper)', fontFamily: 'var(--font-display)' }}>
            Take Damage
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Amount stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Stepper sign="-" onClick={() => setAmount((a) => Math.max(1, a - 1))} size={36} />
          <span style={{ fontSize: 'var(--fs-700)', fontWeight: 700, color: 'var(--paper)', minWidth: 48, textAlign: 'center', lineHeight: 1 }}>
            {amount}
          </span>
          <Stepper sign="+" onClick={() => setAmount((a) => a + 1)} size={36} />
        </div>

        {/* Type segmented control */}
        <div>
          <div style={{ fontSize: 'var(--fs-100)', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>
            Type
          </div>
          <div style={seg}>
            {segBtn(damageType === 'normal', () => setDamageType('normal'), 'Normal')}
            {segBtn(damageType === 'poison', () => setDamageType('poison'), 'Poison')}
            {segBtn(damageType === 'cmdr', () => setDamageType('cmdr'), 'Cmdr')}
          </div>
        </div>

        {/* Lifelink toggle (not for poison) */}
        {damageType !== 'poison' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {togBtn(lifelink, () => setLifelink((v) => !v), 'Lifelink', 'var(--success)')}
          </div>
        )}

        {/* Commander source picker */}
        <AnimatePresence>
          {damageType === 'cmdr' && (
            <motion.div
              key="cmdr-picker"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ fontSize: 'var(--fs-100)', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
                From Commander
              </div>
              {opponents.length === 0 ? (
                <p style={{ fontSize: 'var(--fs-200)', color: 'var(--faint)', textAlign: 'center', margin: 0 }}>
                  No opponents — turn Cmdr off to take plain damage.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {opponents.map((opp) => {
                    const art = cmdPortrait(opp.seat)
                    const selected = sourceSeat === opp.seat
                    return (
                      <button
                        key={opp.seat}
                        onClick={() => setSourceSeat(opp.seat)}
                        title={playerName(opp.seat)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 5,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            border: selected ? '2px solid var(--brand)' : '2px solid var(--hairline)',
                            overflow: 'hidden',
                            background: art ? 'none' : 'var(--ink-3)',
                            backgroundImage: art ? `url('${art}')` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center 15%',
                            transition: 'border-color 130ms',
                            boxShadow: selected ? '0 0 0 3px rgba(77,163,255,0.3)' : 'none',
                          }}
                        >
                          {!art && (
                            <div style={{
                              width: '100%', height: '100%', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              color: 'var(--faint)', fontSize: 20,
                            }}>
                              ⚔
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 'var(--fs-100)', color: selected ? 'var(--brand-bright)' : 'var(--muted)',
                          maxWidth: 60, textAlign: 'center', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: 'var(--font-body)',
                        }}>
                          {playerName(opp.seat)}
                        </span>
                        {/* Running cmdr damage from this source */}
                        {(me?.cmdDamage?.[String(opp.seat)] ?? 0) > 0 && (
                          <span style={{
                            fontSize: 'var(--fs-100)', color: 'var(--danger)', fontWeight: 700,
                          }}>
                            {me.cmdDamage[String(opp.seat)]}/21
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Apply */}
        <button
          onClick={apply}
          style={{
            padding: '10px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--brand)',
            background: 'var(--brand-soft)',
            color: 'var(--brand-bright)',
            fontSize: 'var(--fs-300)',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'background 130ms',
            marginTop: 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(77,163,255,0.28)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand-soft)' }}
        >
          Apply
        </button>
      </motion.div>
    </motion.div>
  )
}

/**
 * ProliferateModal — shows all permanents + players with at least one counter.
 * User checks which to include, then "Proliferate" adds +1 to each counter kind present.
 *
 * Triggered when store.ui.countersModalCardId === '::proliferate'
 */
import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 220,
  background: 'rgba(7,13,26,0.72)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
}

const PANEL: React.CSSProperties = {
  background: 'var(--ink)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-lg)',
  width: '100%',
  maxWidth: 480,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'var(--font-body)',
  color: 'var(--paper)',
}

// ── Entity types ──────────────────────────────────────────────────────────────

interface CardTarget {
  kind: 'card'
  id: string
  name: string
  counters: Record<string, number>
}

interface PlayerTarget {
  kind: 'player'
  seat: number
  name: string
  counters: Record<string, number>
}

type Target = CardTarget | PlayerTarget

function targetKey(t: Target): string {
  return t.kind === 'card' ? `card:${t.id}` : `player:${t.seat}`
}

// ── CounterBadge ──────────────────────────────────────────────────────────────

function CounterBadge({ label, value }: { label: string; value: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 'var(--r-pill)',
      background: 'var(--brand-soft)', border: '1px solid var(--brand)',
      fontSize: 10, color: 'var(--brand-bright)', fontWeight: 600,
      marginRight: 3, marginBottom: 2,
    }}>
      {label}: {value}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProliferateModal() {
  const store = useGameStore()
  const { dispatch } = useGameEngine()

  const isOpen = store.ui.countersModalCardId === '::proliferate'
  const gameState = store.gameState

  const allTargets = useMemo<Target[]>(() => {
    if (!gameState) return []
    const out: Target[] = []

    for (const card of Object.values(gameState.cards)) {
      if (card.zone !== 'battlefield') continue
      const nonZero = Object.entries(card.counters ?? {}).filter(([, v]) => v > 0)
      if (nonZero.length === 0) continue
      out.push({ kind: 'card', id: card.instanceId, name: card.name, counters: Object.fromEntries(nonZero) })
    }

    for (const player of gameState.players) {
      const nonZero = Object.entries(player.counters ?? {}).filter(([, v]) => v > 0)
      if (nonZero.length === 0) continue
      out.push({ kind: 'player', seat: player.seat, name: player.name ?? `Player ${player.seat + 1}`, counters: Object.fromEntries(nonZero) })
    }

    return out
  }, [gameState])

  const [checked, setChecked] = useState<Set<string>>(new Set())

  // Seed all targets checked when the modal opens
  useEffect(() => {
    if (isOpen) {
      setChecked(new Set(allTargets.map(targetKey)))
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: allTargets intentionally omitted — we only want to seed on open, not re-check
  // every time game state ticks while the modal is visible.

  const close = useCallback(() => {
    store.openCountersModal(null)
    setChecked(new Set())
  }, [store])

  function toggleTarget(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (checked.size === allTargets.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(allTargets.map(targetKey)))
    }
  }

  function proliferate() {
    for (const target of allTargets) {
      const key = targetKey(target)
      if (!checked.has(key)) continue
      for (const [kind, value] of Object.entries(target.counters)) {
        if (value <= 0) continue
        if (target.kind === 'card') {
          dispatch({ t: 'card_counter', instanceId: target.id, kind, delta: 1 })
        } else {
          dispatch({ t: 'player_counter', seat: target.seat, kind, delta: 1 })
        }
      }
    }
    store.pushLogEntry(`<b>Proliferate</b> — ${checked.size} target${checked.size !== 1 ? 's' : ''}`)
    close()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div style={OVERLAY} onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          style={PANEL}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px', borderBottom: '1px solid var(--hairline)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="var(--brand-bright)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Proliferate</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                  Choose targets to add +1 to each counter type
                </div>
              </div>
            </div>
            <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '10px 16px' }}>
            {allTargets.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>
                No permanents or players have counters to proliferate.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <button
                    onClick={toggleAll}
                    style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 'var(--r-pill)',
                      background: 'var(--ink-3)', border: '1px solid var(--hairline)',
                      color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)',
                    }}
                  >
                    {checked.size === allTargets.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                {allTargets.map((target) => {
                  const key = targetKey(target)
                  const isChecked = checked.has(key)
                  return (
                    <div
                      key={key}
                      onClick={() => toggleTarget(key)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--r-sm)',
                        background: isChecked ? 'var(--brand-soft)' : 'var(--ink-2)',
                        border: `1px solid ${isChecked ? 'var(--brand)' : 'var(--hairline)'}`,
                        cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                        background: isChecked ? 'var(--brand)' : 'var(--ink-4)',
                        border: `1px solid ${isChecked ? 'var(--brand)' : 'var(--hairline)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isChecked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          color: isChecked ? 'var(--paper)' : 'var(--muted)', marginBottom: 4,
                        }}>
                          {target.kind === 'player' && (
                            <span style={{ fontSize: 10, color: 'var(--faint)', marginRight: 4 }}>PLAYER</span>
                          )}
                          {target.name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                          {Object.entries(target.counters).map(([kind, val]) => (
                            <CounterBadge key={kind} label={kind} value={val} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--hairline)',
            flexShrink: 0, display: 'flex', gap: 8,
          }}>
            <button
              onClick={close}
              style={{
                flex: 1, padding: '9px 16px', borderRadius: 'var(--r-xs)',
                background: 'var(--ink-3)', border: '1px solid var(--hairline)',
                color: 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={proliferate}
              disabled={checked.size === 0}
              style={{
                flex: 2, padding: '9px 16px', borderRadius: 'var(--r-xs)',
                background: checked.size === 0 ? 'var(--ink-3)' : 'var(--brand)',
                border: 'none',
                color: checked.size === 0 ? 'var(--muted)' : '#fff',
                fontWeight: 700, fontSize: 13,
                cursor: checked.size === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Zap size={14} />
              Proliferate{checked.size > 0 ? ` (${checked.size})` : ''}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

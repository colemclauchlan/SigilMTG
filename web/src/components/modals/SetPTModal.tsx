/**
 * SetPTModal — two-mode modal: set +X/+X modifiers or set P/T directly.
 * store.ui.setPTModalCardId encodes both the card ID and the mode:
 *   "instanceId:+x"  → +X/+X mode (add/remove +1/+1 / -1/-1 counters)
 *   "instanceId:pt"  → direct P/T override mode
 */
import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
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
  maxWidth: 360,
  fontFamily: 'var(--font-body)',
  color: 'var(--paper)',
  overflow: 'hidden',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 'var(--r-xs)',
  background: 'var(--ink-3)',
  border: '1px solid var(--hairline)',
  color: 'var(--paper)',
  fontSize: 18,
  fontWeight: 700,
  textAlign: 'center',
  outline: 'none',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
}

const BTN_PRIMARY: React.CSSProperties = {
  flex: 1,
  padding: '9px 16px',
  borderRadius: 'var(--r-xs)',
  background: 'var(--brand)',
  border: 'none',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
}

const BTN_GHOST: React.CSSProperties = {
  flex: 1,
  padding: '9px 16px',
  borderRadius: 'var(--r-xs)',
  background: 'var(--ink-3)',
  border: '1px solid var(--hairline)',
  color: 'var(--muted)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
}

export default function SetPTModal() {
  const store = useGameStore()
  const { dispatch } = useGameEngine()

  const raw = store.ui.setPTModalCardId  // "instanceId:+x" or "instanceId:pt"
  const rawIdx = raw ? raw.lastIndexOf(':') : -1
  const cardId = rawIdx > 0 ? raw!.slice(0, rawIdx) : null
  const mode = rawIdx > 0 ? raw!.slice(rawIdx + 1) : null
  const gameState = store.gameState
  const card = (cardId && gameState?.cards[cardId]) ?? null

  const [pVal, setPVal] = useState('')
  const [tVal, setTVal] = useState('')

  // Reset inputs when modal opens
  useEffect(() => {
    if (!cardId) return
    setPVal('')
    setTVal('')
  }, [cardId])

  const close = useCallback(() => {
    store.openSetPTModal(null)
    setPVal('')
    setTVal('')
  }, [store])

  if (!cardId || !card || !mode) return null

  const isPlusX = mode === '+x'
  const basePower = card.oraclePower ?? '?'
  const baseTough = card.oracleToughness ?? '?'
  const currentCounters = card.counters ?? {}
  const plusCounters = currentCounters['+1/+1'] ?? 0
  const minusCounters = currentCounters['-1/-1'] ?? 0

  function applyPlusX() {
    const p = parseInt(pVal, 10)
    const t = parseInt(tVal, 10)
    if (isNaN(p) && isNaN(t)) { close(); return }

    // We apply +1/+1 or -1/-1 counters to reach the desired modifier.
    // Strategy: for P, use +1/+0 logic isn't in standard counters so we use +1/+1 as proxy.
    // Simplest: add delta in +1/+1 (positive) or -1/-1 (negative) for the combined modifier.
    // The user entered explicit P and T modifiers; we honor each with +1/+1 if both equal, else set separately.
    const pMod = isNaN(p) ? 0 : p
    const tMod = isNaN(t) ? 0 : t
    const combined = Math.min(pMod, tMod)  // how many +1/+1 or -1/-1 we can use
    const remainder = pMod - tMod

    if (combined > 0) {
      dispatch({ t: 'card_counter', instanceId: cardId, kind: '+1/+1', delta: combined })
    } else if (combined < 0) {
      dispatch({ t: 'card_counter', instanceId: cardId, kind: '-1/-1', delta: Math.abs(combined) })
    }
    if (remainder > 0) {
      dispatch({ t: 'card_counter', instanceId: cardId, kind: '+1/+0', delta: remainder })
    } else if (remainder < 0) {
      dispatch({ t: 'card_counter', instanceId: cardId, kind: '+0/+1', delta: Math.abs(remainder) })
    }
    close()
  }

  function applySetPT() {
    const p = parseInt(pVal, 10)
    const t = parseInt(tVal, 10)
    if (isNaN(p) && isNaN(t)) { close(); return }

    const baseP = parseInt(basePower, 10) || 0
    const baseT = parseInt(baseTough, 10) || 0
    const targetP = isNaN(p) ? baseP : p
    const targetT = isNaN(t) ? baseT : t

    // Clear existing +1/+1 and -1/-1 counters, then add as needed to hit target
    if (plusCounters !== 0) {
      dispatch({ t: 'card_counter', instanceId: cardId, kind: '+1/+1', delta: -plusCounters })
    }
    if (minusCounters !== 0) {
      dispatch({ t: 'card_counter', instanceId: cardId, kind: '-1/-1', delta: -minusCounters })
    }

    const neededP = targetP - baseP
    const neededT = targetT - baseT
    const combined = Math.min(neededP, neededT)
    const remP = neededP - combined
    const remT = neededT - combined

    if (combined > 0) {
      dispatch({ t: 'card_counter', instanceId: cardId, kind: '+1/+1', delta: combined })
    } else if (combined < 0) {
      dispatch({ t: 'card_counter', instanceId: cardId, kind: '-1/-1', delta: Math.abs(combined) })
    }
    if (remP > 0) dispatch({ t: 'card_counter', instanceId: cardId, kind: '+1/+0', delta: remP })
    if (remT > 0) dispatch({ t: 'card_counter', instanceId: cardId, kind: '+0/+1', delta: remT })

    close()
  }

  function handleApply() {
    if (isPlusX) applyPlusX()
    else applySetPT()
  }

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--hairline)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{card.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {isPlusX ? 'Set +X/+X modifier' : 'Set P/T directly'}
              </div>
            </div>
            <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 16 }}>
            {isPlusX ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textAlign: 'center' }}>
                  Enter the modifier to add (negative to remove). Current: <span style={{ color: 'var(--brand-bright)' }}>+{plusCounters}/+{plusCounters}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Power mod</div>
                    <input
                      type="number"
                      value={pVal}
                      onChange={(e) => setPVal(e.target.value)}
                      placeholder="0"
                      style={INPUT_STYLE}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Toughness mod</div>
                    <input
                      type="number"
                      value={tVal}
                      onChange={(e) => setTVal(e.target.value)}
                      placeholder="0"
                      style={INPUT_STYLE}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textAlign: 'center' }}>
                  Base P/T: <span style={{ color: 'var(--brand-bright)', fontWeight: 700 }}>{basePower}/{baseTough}</span>
                  &nbsp;&middot;&nbsp;Current effective: <span style={{ color: 'var(--paper)', fontWeight: 700 }}>{(parseInt(basePower, 10) || 0) + plusCounters - minusCounters}/{(parseInt(baseTough, 10) || 0) + plusCounters - minusCounters}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New power</div>
                    <input
                      type="number"
                      value={pVal}
                      onChange={(e) => setPVal(e.target.value)}
                      placeholder={basePower}
                      style={INPUT_STYLE}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New toughness</div>
                    <input
                      type="number"
                      value={tVal}
                      onChange={(e) => setTVal(e.target.value)}
                      placeholder={baseTough}
                      style={INPUT_STYLE}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={BTN_GHOST} onClick={close}>Cancel</button>
              <button style={BTN_PRIMARY} onClick={handleApply}>Apply</button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

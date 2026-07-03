/**
 * CountersModal — counters & labels modal.
 * Opens when store.ui.countersModalCardId is a real card ID (not '::proliferate').
 * Shows active counters, full common-counter list, label input, and keyword token.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

const COMMON_COUNTERS = [
  '+1/+1', '-1/-1', 'loyalty', 'charge', 'stun',
  '+1/+0', '+0/+1', 'shield', 'oil', 'lore',
  'time', 'fade', 'quest', 'page', 'ice',
  'gold', 'poison', 'energy', 'experience',
  'treasure', 'clue', 'food', 'blood',
]

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
  maxWidth: 440,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'var(--font-body)',
  color: 'var(--paper)',
}

function CounterRow({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 0', borderBottom: '1px solid var(--hairline)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--paper)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={onDec} style={BTN_SM}><Minus size={10} /></button>
        <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 600, color: value !== 0 ? 'var(--brand-bright)' : 'var(--muted)' }}>{value}</span>
        <button onClick={onInc} style={BTN_SM}><Plus size={10} /></button>
      </div>
    </div>
  )
}

const BTN_SM: React.CSSProperties = {
  width: 24, height: 24,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--ink-3)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-xs)',
  color: 'var(--paper)',
  cursor: 'pointer',
  padding: 0,
}

export default function CountersModal() {
  const store = useGameStore()
  const { dispatch } = useGameEngine()

  const rawId = store.ui.countersModalCardId
  // '::proliferate' is handled by ProliferateModal — skip here
  const cardId = (rawId && !rawId.startsWith('::')) ? rawId : null
  const gameState = store.gameState
  const card: import("../../types/game").CardInstance | null = cardId ? (gameState?.cards[cardId] ?? null) : null

  const [labelText, setLabelText] = useState('')
  const [keywordText, setKeywordText] = useState('')

  const close = useCallback(() => {
    store.openCountersModal(null)
    setLabelText('')
    setKeywordText('')
  }, [store])

  if (!cardId || !card) return null

  const activeCounters = card.counters ?? {}
  const activeKeys = Object.keys(activeCounters).filter((k) => (activeCounters[k] ?? 0) !== 0)

  function counterDelta(kind: string, delta: number) {
    dispatch({ t: 'card_counter', instanceId: cardId!, kind, delta })
  }

  function addLabel() {
    if (!labelText.trim()) return
    const id = 'ann-' + Date.now()
    dispatch({
      t: 'annotation_create',
      id,
      kind: 'label',
      text: labelText.trim(),
      value: 0,
      x: card!.x ?? 0,
      y: card!.y ?? 0,
      seat: store.mySeat,
      pinnedCardId: cardId,
    })
    setLabelText('')
  }

  function addKeyword() {
    if (!keywordText.trim()) return
    const id = 'ann-kw-' + Date.now()
    dispatch({
      t: 'annotation_create',
      id,
      kind: 'keyword',
      text: keywordText.trim(),
      value: 0,
      x: card!.x ?? 0,
      y: card!.y ?? 0,
      seat: store.mySeat,
      color: '#46b277',
      pinnedCardId: cardId,
    })
    setKeywordText('')
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{card.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Counters & Labels</div>
            </div>
            <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>

            {/* Active counters */}
            {activeKeys.length > 0 && (
              <section style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Active Counters</div>
                {activeKeys.map((kind) => (
                  <CounterRow
                    key={kind}
                    label={kind}
                    value={activeCounters[kind] ?? 0}
                    onDec={() => counterDelta(kind, -1)}
                    onInc={() => counterDelta(kind, 1)}
                  />
                ))}
              </section>
            )}

            {/* Common counter list */}
            <section style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>All Counters</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {COMMON_COUNTERS.map((kind) => {
                  const val = activeCounters[kind] ?? 0
                  return (
                    <div key={kind} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', borderRadius: 'var(--r-xs)',
                      background: val !== 0 ? 'var(--brand-soft)' : 'var(--ink-2)',
                      border: `1px solid ${val !== 0 ? 'var(--brand)' : 'var(--hairline)'}`,
                    }}>
                      <span style={{ fontSize: 11, color: val !== 0 ? 'var(--paper)' : 'var(--muted)' }}>{kind}</span>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <button onClick={() => counterDelta(kind, -1)} style={{ ...BTN_SM, width: 18, height: 18 }}><Minus size={8} /></button>
                        <span style={{ minWidth: 20, textAlign: 'center', fontSize: 11, fontWeight: 600 }}>{val}</span>
                        <button onClick={() => counterDelta(kind, 1)} style={{ ...BTN_SM, width: 18, height: 18 }}><Plus size={8} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Label input */}
            <section style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Add Label</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={labelText}
                  onChange={(e) => setLabelText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addLabel() }}
                  placeholder="e.g. Monarch, City's Blessing…"
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 'var(--r-xs)',
                    background: 'var(--ink-3)', border: '1px solid var(--hairline)',
                    color: 'var(--paper)', fontSize: 12, outline: 'none',
                    fontFamily: 'var(--font-body)',
                  }}
                />
                <button
                  onClick={addLabel}
                  style={{ padding: '6px 12px', borderRadius: 'var(--r-xs)', background: 'var(--brand-soft)', border: '1px solid var(--brand)', color: 'var(--brand-bright)', fontSize: 12, cursor: 'pointer' }}
                >
                  Add
                </button>
              </div>
            </section>

            {/* Keyword token */}
            <section>
              <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Grant Keyword</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addKeyword() }}
                  placeholder="e.g. Flying, Haste, Vigilance…"
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 'var(--r-xs)',
                    background: 'var(--ink-3)', border: '1px solid var(--hairline)',
                    color: 'var(--paper)', fontSize: 12, outline: 'none',
                    fontFamily: 'var(--font-body)',
                  }}
                />
                <button
                  onClick={addKeyword}
                  style={{ padding: '6px 12px', borderRadius: 'var(--r-xs)', background: 'rgba(70,178,119,0.18)', border: '1px solid #46b277', color: '#46b277', fontSize: 12, cursor: 'pointer' }}
                >
                  Grant
                </button>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

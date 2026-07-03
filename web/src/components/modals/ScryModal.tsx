/**
 * ScryModal — Scry / Surveil UI.
 * Shows top N library cards revealed; each can be kept or sent down/to graveyard.
 * Reorder arrows let the player arrange the "keep on top" cards.
 */
import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { CardInstance } from '../../types/game'

const CARD_BACK = 'https://cards.scryfall.io/normal/back/0/0/default_card_back.jpg'

type Decision = 'top' | 'bottom' | 'graveyard'

export default function ScryModal() {
  const scryOpen = useGameStore((s) => s.ui.scryOpen)
  const scryCount = useGameStore((s) => s.ui.scryCount)
  const scryMode = useGameStore((s) => s.ui.scryMode)
  const closeScry = useGameStore((s) => s.closeScry)
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const imagesById = useGameStore((s) => s.imagesById)
  const pushLogEntry = useGameStore((s) => s.pushLogEntry)
  const { dispatch } = useGameEngine()

  // Top N library cards sorted by pos (top = lowest pos)
  const topCards: CardInstance[] = useMemo(() => {
    if (!gameState) return []
    return Object.values(gameState.cards)
      .filter((c) => c.zone === 'library' && c.ownerSeat === mySeat)
      .sort((a, b) => a.pos - b.pos)
      .slice(0, scryCount)
  }, [gameState, mySeat, scryCount])

  // Ordered sequence (instanceIds) — user can reorder
  const [order, setOrder] = useState<string[]>(() => topCards.map((c) => c.instanceId))
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => {
    const init: Record<string, Decision> = {}
    for (const c of topCards) init[c.instanceId] = 'top'
    return init
  })

  // Re-sync order when topCards changes (modal just opened)
  const initialIds = topCards.map((c) => c.instanceId).join(',')
  const [lastIds, setLastIds] = useState(initialIds)
  if (initialIds !== lastIds) {
    setLastIds(initialIds)
    setOrder(topCards.map((c) => c.instanceId))
    const init: Record<string, Decision> = {}
    for (const c of topCards) init[c.instanceId] = 'top'
    setDecisions(init)
  }

  const cardMap = useMemo(() => {
    const m: Record<string, CardInstance> = {}
    for (const c of topCards) m[c.instanceId] = c
    return m
  }, [topCards])

  function setDecision(id: string, d: Decision) {
    setDecisions((prev) => ({ ...prev, [id]: d }))
  }

  function moveLeft(id: string) {
    setOrder((prev) => {
      const i = prev.indexOf(id)
      if (i <= 0) return prev
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }

  function moveRight(id: string) {
    setOrder((prev) => {
      const i = prev.indexOf(id)
      if (i < 0 || i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }

  function apply() {
    // Cards going down/to graveyard first
    const downDest = scryMode === 'surveil' ? 'graveyard' : 'library'
    for (const id of order) {
      const d = decisions[id] ?? 'top'
      if (d === 'graveyard' || d === 'bottom') {
        const card = cardMap[id]
        if (!card) continue
        dispatch({
          t: 'card_move',
          instanceId: id,
          toZone: downDest,
          seat: card.controllerSeat,
          x: null, y: null,
        })
      }
    }
    // Cards staying on top — dispatch library_scry with the ordered keep-on-top IDs
    const keepIds = order.filter((id) => (decisions[id] ?? 'top') === 'top')
    if (keepIds.length > 0) {
      dispatch({ t: 'library_scry', seat: mySeat, instanceIds: keepIds })
    }

    const keptCount = keepIds.length
    const sentDown = order.length - keptCount
    pushLogEntry(
      `<b>${scryMode === 'scry' ? 'Scry' : 'Surveil'} ${scryCount}</b>: kept ${keptCount} on top, sent ${sentDown} ${scryMode === 'surveil' ? 'to graveyard' : 'to bottom'}`
    )
    closeScry()
  }

  const modeLabel = scryMode === 'scry' ? 'Scry' : 'Surveil'
  const downLabel = scryMode === 'scry' ? 'To bottom' : 'To graveyard'
  const downColor = scryMode === 'scry' ? '#4da3ff' : '#e0655c'

  return (
    <AnimatePresence>
      {scryOpen && (
        <motion.div
          key="scry-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9100,
            background: 'rgba(7,13,26,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 16px 32px',
          }}
        >
          <motion.div
            key="scry-panel"
            initial={{ opacity: 0, y: 64 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-xl)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: 720,
              padding: '20px 24px 24px',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                color: 'var(--paper)', fontSize: '1rem', flex: 1,
              }}>
                {modeLabel} {scryCount}
              </span>
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: 0 }}>
                Arrange top cards, then Apply.
              </p>
              <button
                onClick={closeScry}
                title="Cancel"
                style={{
                  background: 'var(--ink-2)', border: 'none',
                  borderRadius: 'var(--r-sm)', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--muted)', transition: 'color 0.13s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--paper)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Card row */}
            {topCards.length === 0 ? (
              <p style={{
                color: 'var(--faint)', fontSize: '0.83rem',
                textAlign: 'center', padding: '16px 0',
              }}>
                Library is empty.
              </p>
            ) : (
              <div style={{
                display: 'flex', gap: 16, overflowX: 'auto',
                padding: '4px 0 8px', alignItems: 'flex-start',
              }}>
                {order.map((id, idx) => {
                  const card = cardMap[id]
                  if (!card) return null
                  const meta = card.cardId ? imagesById[card.cardId] : null
                  const imgSrc = meta?.img ?? CARD_BACK
                  const decision = decisions[id] ?? 'top'
                  const isKeep = decision === 'top'

                  return (
                    <ScryCard
                      key={id}
                      card={card}
                      imgSrc={imgSrc}
                      decision={decision}
                      isFirst={idx === 0}
                      isLast={idx === order.length - 1}
                      downLabel={downLabel}
                      downColor={downColor}
                      onKeep={() => setDecision(id, 'top')}
                      onDown={() => setDecision(id, scryMode === 'surveil' ? 'graveyard' : 'bottom')}
                      onMoveLeft={() => moveLeft(id)}
                      onMoveRight={() => moveRight(id)}
                      dimmed={!isKeep}
                    />
                  )
                })}
              </div>
            )}

            {/* Apply button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={apply}
                style={{
                  background: 'var(--brand)',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  color: '#fff',
                  padding: '9px 24px',
                  fontSize: '0.9rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'opacity 0.13s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
              >
                Apply
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Individual scry card ──────────────────────────────────────────────────────

interface ScryCardProps {
  card: CardInstance
  imgSrc: string
  decision: Decision
  isFirst: boolean
  isLast: boolean
  downLabel: string
  downColor: string
  dimmed: boolean
  onKeep: () => void
  onDown: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
}

function ScryCard({
  card, imgSrc, decision, isFirst, isLast,
  downLabel, downColor, dimmed,
  onKeep, onDown, onMoveLeft, onMoveRight,
}: ScryCardProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 8, flexShrink: 0, width: 110,
      opacity: dimmed ? 0.45 : 1,
      transition: 'opacity 0.15s',
    }}>
      {/* Card image */}
      <img
        src={imgSrc}
        alt={card.name}
        onError={(e) => { (e.target as HTMLImageElement).src = CARD_BACK }}
        style={{
          width: 110, height: Math.round(110 * 1.4),
          borderRadius: 'var(--r-sm)', objectFit: 'cover',
          display: 'block', boxShadow: 'var(--shadow-md)',
          border: decision === 'top'
            ? '2px solid var(--brand)'
            : `2px solid ${downColor}`,
          transition: 'border-color 0.15s',
        }}
      />

      {/* Card name */}
      <span style={{
        color: 'var(--paper-dim)', fontSize: '0.72rem', fontWeight: 500,
        textAlign: 'center', lineHeight: 1.3,
        maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {card.name}
      </span>

      {/* Keep / Down buttons */}
      <div style={{ display: 'flex', gap: 4, width: '100%' }}>
        <DecisionBtn
          label="Keep on top"
          active={decision === 'top'}
          activeColor="var(--brand)"
          onClick={onKeep}
        />
        <DecisionBtn
          label={downLabel}
          active={decision !== 'top'}
          activeColor={downColor}
          onClick={onDown}
        />
      </div>

      {/* Reorder arrows */}
      <div style={{ display: 'flex', gap: 4 }}>
        <ReorderBtn
          icon={<ChevronLeft size={13} />}
          label="Move left"
          disabled={isFirst}
          onClick={onMoveLeft}
        />
        <ReorderBtn
          icon={<ChevronRight size={13} />}
          label="Move right"
          disabled={isLast}
          onClick={onMoveRight}
        />
      </div>
    </div>
  )
}

function DecisionBtn({
  label, active, activeColor, onClick,
}: { label: string; active: boolean; activeColor: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: '4px 0', fontSize: '0.65rem', fontWeight: 700,
        border: `1px solid ${active ? activeColor : 'var(--hairline)'}`,
        borderRadius: 'var(--r-sm)',
        background: active
          ? `${activeColor}22`
          : (hov ? 'var(--ink-2)' : 'none'),
        color: active ? activeColor : 'var(--muted)',
        cursor: 'pointer', transition: 'all 0.12s',
        whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis',
        textAlign: 'center',
      }}
    >
      {label}
    </button>
  )
}

function ReorderBtn({
  icon, label, disabled, onClick,
}: { icon: React.ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && !disabled ? 'var(--ink-2)' : 'none',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-sm)',
        color: disabled ? 'var(--ink-4)' : (hov ? 'var(--paper)' : 'var(--muted)'),
        padding: '3px 6px', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center',
        transition: 'all 0.12s',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {icon}
    </button>
  )
}

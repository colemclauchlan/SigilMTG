/**
 * CardNode — renders a single card on the battlefield or in the hand zone.
 */
import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { CardInstance } from '../../types/game'

const CARD_BACK = 'https://cards.scryfall.io/normal/back/0/0/default_card_back.jpg'

/** Find a zone pile under the pointer (for drag-to-zone). */
function zoneAtPoint(x: number, y: number): { zone: string; seat: number } | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const z = (el as HTMLElement).dataset?.zone
    if (z) return { zone: z, seat: Number((el as HTMLElement).dataset.seat ?? 0) }
  }
  return null
}

interface CardNodeProps {
  card: CardInstance
  /** 'board' = battlefield card, 'hand' = hand tray card */
  context: 'board' | 'hand'
  /** Fan rotation for hand cards (CSS degrees) */
  fanRot?: number
  fanLift?: number
  onDragStart?: (cardId: string, e: React.PointerEvent) => void
  onDragEnd?: () => void
  /** Enable drag-to-reposition (own seat's battlefield cards) */
  canDrag?: boolean
  /** Owning seat (hand cards) — for hand-drag drop coordinate conversion */
  seat?: number
}

const PT_COUNTER_KEYS = new Set(['+1/+1', '-1/-1', '+1/+0', '+0/+1'])
function calcPT(card: CardInstance): [string, string] | null {
  if (!card.isCreature) return null
  const oP = card.oraclePower ?? null
  const oT = card.oracleToughness ?? null
  if (oP == null || oT == null) return null
  const plus = card.counters['+1/+1'] ?? 0
  const minus = card.counters['-1/-1'] ?? 0
  const pPlus = card.counters['+1/+0'] ?? 0
  const tPlus = card.counters['+0/+1'] ?? 0
  const p = Number(oP) + plus - minus + pPlus
  const t = Number(oT) + plus - minus + tPlus
  return [isNaN(p) ? oP : String(p), isNaN(t) ? oT : String(t)]
}

export default function CardNode({ card, context, fanRot = 0, fanLift = 0, onDragStart, onDragEnd, canDrag = false, seat }: CardNodeProps) {
  const imagesById = useGameStore((s) => s.imagesById)
  const openCardMenu = useGameStore((s) => s.openCardMenu)
  const highlightedCardIds = useGameStore((s) => s.ui.highlightedCardIds)
  const dragCardId = useGameStore((s) => s.ui.dragCardId)
  const setDragCard = useGameStore((s) => s.setDragCard)
  const setDropHighlight = useGameStore((s) => s.setDropHighlight)
  const setHoveredCard = useGameStore((s) => s.setHoveredCard)
  const targetingSource = useGameStore((s) => s.ui.targetingSource)
  const finishTargeting = useGameStore((s) => s.finishTargeting)
  const attachSource = useGameStore((s) => s.ui.attachSource)
  const cancelAttaching = useGameStore((s) => s.cancelAttaching)
  const mulliganBottom = useGameStore((s) => s.ui.mulliganBottom)
  const setMulliganBottom = useGameStore((s) => s.setMulliganBottom)
  const host = useGameStore((s) => (card.attachedTo ? (s.gameState?.cards?.[card.attachedTo] ?? null) : null))
  const { dispatch } = useGameEngine()

  const imgMeta = card.cardId ? imagesById[card.cardId] : null
  const imgSrc = card.faceDown
    ? CARD_BACK
    : (imgMeta?.img ?? CARD_BACK)

  const isSelected = highlightedCardIds.has(card.instanceId)
  const isOnStack = card.zone === 'stack'
  const isDragging = dragCardId === card.instanceId

  const width = context === 'hand' ? 88 : 71
  const height = Math.round(width * 1.4)

  const pt = calcPT(card)
  const showPT = !!(card.isCreature && (pt || card.attachedTo || Object.keys(card.counters).some((k) => PT_COUNTER_KEYS.has(k))))

  const nonPTCounters = Object.entries(card.counters).filter(
    ([k, v]) => !(card.isCreature && PT_COUNTER_KEYS.has(k)) && v > 0
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef({ active: false, sx: 0, sy: 0, cx: 0, cy: 0, scale: 1, moved: false, lastX: 0, lastY: 0 })
  const [handGhost, setHandGhost] = useState<{ x: number; y: number } | null>(null)
  const handDragRef = useRef({ active: false, moved: false })
  const suppressClickRef = useRef(false) // a drag/dbl-click consumes the trailing click (mulligan guard)

  function handleRightClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    openCardMenu(card.instanceId, { x: e.clientX, y: e.clientY })
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (context === 'hand') {
      if (mulliganBottom > 0) return // bottoming phase: single-click bottoms; don't play
      e.stopPropagation()
      suppressClickRef.current = true
      dispatch({
        t: 'card_move',
        instanceId: card.instanceId,
        toZone: 'battlefield',
        x: 90 + Math.random() * 480,
        y: 110 + Math.random() * 240,
      })
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    if (context === 'hand') {
      handDragRef.current = { active: true, moved: false }
      try { containerRef.current?.setPointerCapture?.(e.pointerId) } catch { /* ignore */ }
      return
    }
    if (context !== 'board' || !canDrag) return
    const rect = containerRef.current?.getBoundingClientRect()
    // tapped cards are rotated 90deg, so the rendered width maps to the card's height
    const scale = rect ? (card.tapped ? rect.height : rect.width) / width : 1
    // attached cards are rendered at host.x+24 / host.y+24 — start the drag from there to avoid a jump
    const startX = host ? (host.x ?? 0) + 24 : (card.x ?? 0)
    const startY = host ? (host.y ?? 0) + 24 : (card.y ?? 0)
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, cx: startX, cy: startY, scale, moved: false, lastX: startX, lastY: startY }
    setDragCard(card.instanceId)
    onDragStart?.(card.instanceId, e)
    try { containerRef.current?.setPointerCapture?.(e.pointerId) } catch { /* no active pointer */ }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (context === 'hand') {
      const h = handDragRef.current
      if (!h.active) return
      h.moved = true
      setHandGhost({ x: e.clientX, y: e.clientY })
      return
    }
    const d = dragRef.current
    if (!d.active) return
    const dx = (e.clientX - d.sx) / d.scale
    const dy = (e.clientY - d.sy) / d.scale
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true
    const nx = Math.max(0, d.cx + dx), ny = Math.max(0, d.cy + dy)
    d.lastX = nx; d.lastY = ny
    setDragPos({ x: nx, y: ny })
    const over = zoneAtPoint(e.clientX, e.clientY)
    setDropHighlight(over && over.zone !== 'battlefield' ? (over.zone as never) : null)
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (context === 'hand') {
      const h = handDragRef.current
      if (!h.active) return
      h.active = false
      try { containerRef.current?.releasePointerCapture?.(e.pointerId) } catch { /* ignore */ }
      if (h.moved && e.clientY < window.innerHeight - 150) {
        const mat = document.querySelector(`[data-seat-mat="${seat ?? 0}"]`) as HTMLElement | null
        let x = 50, y = 55
        if (mat) {
          const rect = mat.getBoundingClientRect()
          const rw = Number(mat.dataset.regionW) || rect.width
          const scale = (rect.width / rw) || 1
          x = Math.max(0, (e.clientX - rect.left) / scale - 35)
          y = Math.max(0, (e.clientY - rect.top) / scale - 49)
        }
        dispatch({ t: 'card_move', instanceId: card.instanceId, toZone: 'battlefield', x: Math.round(x), y: Math.round(y) } as never)
      }
      if (h.moved) suppressClickRef.current = true
      setHandGhost(null)
      return
    }
    const d = dragRef.current
    if (context !== 'board' || !d.active) return
    d.active = false
    setDragCard(null)
    onDragEnd?.()
    try { containerRef.current?.releasePointerCapture?.(e.pointerId) } catch { /* ignore */ }
    setDropHighlight(null)
    const drop = zoneAtPoint(e.clientX, e.clientY)
    if (card.attachedTo && d.moved) {
      // dragging an attached card detaches it first, else the reposition is ignored (render follows host)
      dispatch({ t: 'card_attach', instanceId: card.instanceId, attachedTo: null } as never)
    }
    if (d.moved && drop && drop.zone !== 'battlefield') {
      dispatch({ t: 'card_move', instanceId: card.instanceId, toZone: drop.zone as never, seat: drop.seat } as never)
    } else if (d.moved) {
      dispatch({ t: 'card_move', instanceId: card.instanceId, toZone: 'battlefield', x: Math.round(d.lastX), y: Math.round(d.lastY) })
    } else if (!targetingSource && !attachSource) {
      // a static click (no drag) -> tap / untap (don't mis-drop into an overlapping zone; suppressed while targeting)
      dispatch({ t: 'card_tap', instanceId: card.instanceId, tapped: !card.tapped } as never)
    }
    setDragPos(null)
  }

  return (
    <motion.div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      data-instance-id={card.instanceId}
      onContextMenu={handleRightClick}
      onClick={(e) => {
        if (suppressClickRef.current) { suppressClickRef.current = false; return }
        if (context === 'hand') {
          if (mulliganBottom > 0 && e.detail <= 1) { dispatch({ t: 'card_move', instanceId: card.instanceId, toZone: 'library' } as never); setMulliganBottom(mulliganBottom - 1) }
          return
        }
        if (context !== 'board') return
        if (targetingSource && targetingSource !== card.instanceId) { finishTargeting(card.instanceId); return }
        if (attachSource && attachSource !== card.instanceId) { dispatch({ t: 'card_attach', instanceId: attachSource, attachedTo: card.instanceId } as never); cancelAttaching() }
      }}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={() => setHoveredCard(card.instanceId)}
      onPointerLeave={() => setHoveredCard(null)}
      initial={context === 'board' ? { opacity: 0, scale: 0.9 } : { opacity: 0 }}
      animate={{
        rotate: context === 'board' ? (card.tapped ? 90 : 0) : (handGhost ? 0 : (fanRot ?? 0)),
        y: context === 'hand' && !handGhost ? -(fanLift ?? 0) : 0,
        opacity: isOnStack ? 0.4 : isDragging ? 0.55 : 1,
        scale: context === 'board' ? 1 : undefined,
      }}
      whileHover={context === 'board' ? { scale: 1.07 } : { scale: 1.35, y: -10 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: context === 'board' ? 'absolute' : (handGhost ? 'fixed' : 'relative'),
        left: context === 'board' ? (dragPos?.x ?? (host ? (host.x ?? 0) + 24 : (card.x ?? 0))) : (handGhost ? handGhost.x - width / 2 : undefined),
        top: context === 'board' ? (dragPos?.y ?? (host ? (host.y ?? 0) + 24 : (card.y ?? 0))) : (handGhost ? handGhost.y - height / 2 : undefined),
        width,
        height,
        flexShrink: 0,
        borderRadius: 'var(--r-card)',
        cursor: context === 'hand' ? 'pointer' : 'grab',
        userSelect: 'none',
        boxShadow: isSelected
          ? '0 0 0 2px var(--brand), var(--glow)'
          : 'var(--shadow-md)',
        // hand fan is driven via framer-motion animate (rotate/y) so it isn't overridden by motion's transform
        zIndex: handGhost ? 200 : isSelected ? 10 : isDragging ? 20 : undefined,
      } as React.CSSProperties}
      className="card-node group"
    >
      {/* Card image */}
      <img
        src={imgSrc}
        alt={card.name}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 'var(--r-card)',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = CARD_BACK
        }}
      />

      {/* Hover glow overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        style={{
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--glow)',
        }}
      />

      {/* Token badge */}
      {card.isToken && (
        <div
          style={{
            position: 'absolute', top: 3, left: 3,
            background: 'var(--brand-deep)', color: 'var(--paper)',
            borderRadius: 4, fontSize: 9, fontWeight: 700,
            padding: '1px 4px', letterSpacing: '0.04em',
          }}
        >
          T
        </div>
      )}

      {/* Commander badge */}
      {card.isCommander && (
        <div
          style={{
            position: 'absolute', top: 3, right: 3,
            background: 'rgba(180,140,20,0.9)', color: '#fffbe8',
            borderRadius: 4, fontSize: 9, fontWeight: 700,
            padding: '1px 4px',
          }}
        >
          C
        </div>
      )}

      {/* Granted keywords pill */}
      {card.grantedKeywords && card.grantedKeywords.length > 0 && (
        <div
          style={{
            position: 'absolute', top: context === 'board' ? 22 : 26, left: 3,
            background: 'rgba(70,178,119,0.9)', color: '#fff',
            borderRadius: 4, fontSize: 8, fontWeight: 700,
            padding: '1px 4px', maxWidth: width - 8,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {card.grantedKeywords.join(', ')}
        </div>
      )}

      {/* Non-PT counters badge */}
      {nonPTCounters.length > 0 && (
        <div
          style={{
            position: 'absolute', top: 3, left: card.isToken ? 22 : 3,
            background: 'rgba(77,163,255,0.88)', color: '#fff',
            borderRadius: 4, fontSize: 9, fontWeight: 700,
            padding: '1px 5px',
          }}
        >
          {nonPTCounters.map(([k, v]) => `${v}${k.slice(0, 2)}`).join(' ')}
        </div>
      )}

      {/* P/T badge */}
      {showPT && pt && (
        <div
          style={{
            position: 'absolute', bottom: 4, right: 4,
            background: 'rgba(46,178,120,0.93)', color: '#fff',
            borderRadius: 5, fontSize: 10, fontWeight: 800,
            padding: '2px 5px', lineHeight: 1.2,
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            letterSpacing: '0.01em',
          }}
        >
          {pt[0]}/{pt[1]}
        </div>
      )}

      {/* Face-down indicator */}
      {card.faceDown && (
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: 'var(--r-card)',
            background: 'rgba(7,13,26,0.55)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          }}
        >
          FACE DOWN
        </div>
      )}
    </motion.div>
  )
}

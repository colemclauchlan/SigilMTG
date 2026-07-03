/**
 * PinnedCounter — draggable fixed-position counter pills from gameState.annotations.
 * Each annotation of kind='counter' renders independently, stacked 56px apart by default.
 */
import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { AnnotationState } from '../../types/game'

// Individual draggable counter pill
function CounterPill({
  annotation,
  defaultY,
}: {
  annotation: AnnotationState
  defaultY: number
}) {
  const { dispatch } = useGameEngine()

  // Convert from % coords back to px, or use defaults
  const initialX = annotation.x > 0 ? (annotation.x / 100) * window.innerWidth : 16
  const initialY = annotation.y > 0 ? (annotation.y / 100) * window.innerHeight : defaultY

  const [pos, setPos] = useState({ x: initialX, y: initialY })
  const [value, setValue] = useState(annotation.value)
  const dragOrigin = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOrigin.current) return
    setPos({
      x: Math.max(0, dragOrigin.current.px + e.clientX - dragOrigin.current.mx),
      y: Math.max(0, dragOrigin.current.py + e.clientY - dragOrigin.current.my),
    })
  }, [])

  const onPointerUp = useCallback(() => {
    if (!dragOrigin.current) return
    dragOrigin.current = null
    // Dispatch move with % coords
    dispatch({
      t: 'annotation_move',
      id: annotation.id,
      x: (pos.x / window.innerWidth) * 100,
      y: (pos.y / window.innerHeight) * 100,
    })
  }, [dispatch, annotation.id, pos])

  const adjust = (delta: number) => {
    const next = value + delta
    setValue(next)
    dispatch({ t: 'annotation_update', id: annotation.id, value: next })
  }

  const remove = () => {
    dispatch({ t: 'annotation_delete', id: annotation.id })
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--ink-3)',
        border: '1px solid var(--hairline)',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'grab',
        userSelect: 'none',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Label */}
      {annotation.text && (
        <span
          style={{
            fontSize: 'var(--fs-100)',
            color: 'var(--muted)',
            fontWeight: 600,
            letterSpacing: '0.05em',
            maxWidth: 60,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {annotation.text}
        </span>
      )}

      {/* − button */}
      <button onClick={() => adjust(-1)} style={adjBtnStyle}>−</button>

      {/* Count */}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-300)',
          fontWeight: 700,
          color: 'var(--paper)',
          minWidth: 24,
          textAlign: 'center',
        }}
      >
        {value}
      </span>

      {/* + button */}
      <button onClick={() => adjust(1)} style={adjBtnStyle}>+</button>

      {/* Close */}
      <button onClick={remove} style={{ ...adjBtnStyle, color: 'var(--muted)', marginLeft: 2 }}>
        <X size={10} />
      </button>
    </div>
  )
}

const adjBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: 'var(--r-xs)',
  border: 'none',
  background: 'rgba(255,255,255,0.07)',
  color: 'var(--paper-dim)',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
}

export default function PinnedCounter() {
  const gameState = useGameStore((s) => s.gameState)

  if (!gameState) return null

  const counterAnnotations = Object.values(gameState.annotations).filter(
    (a) => a.kind === 'counter'
  )

  if (counterAnnotations.length === 0) return null

  // Base Y so counters appear below the HUD, stacked 56px apart
  const BASE_Y = 56

  return (
    <>
      {counterAnnotations.map((ann, idx) => (
        <CounterPill
          key={ann.id}
          annotation={ann}
          defaultY={BASE_Y + idx * 56}
        />
      ))}
    </>
  )
}

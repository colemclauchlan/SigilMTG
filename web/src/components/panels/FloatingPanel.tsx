/**
 * FloatingPanel — generic draggable/minimizable floating panel.
 * Floats over the full-window board at position: fixed.
 */
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, X, ChevronLeft } from 'lucide-react'

export interface FloatingPanelProps {
  title: string
  defaultPos?: { x: number; y: number }
  defaultOpen?: boolean
  onClose?: () => void
  children: React.ReactNode
  width?: number
  zIndex?: number
}

export default function FloatingPanel({
  title,
  defaultPos = { x: 120, y: 80 },
  defaultOpen = true,
  onClose,
  children,
  width = 320,
  zIndex = 100,
}: FloatingPanelProps) {
  const [pos, setPos] = useState(defaultPos)
  const [minimized, setMinimized] = useState(!defaultOpen)
  const dragOrigin = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const titleBarRef = useRef<HTMLDivElement>(null)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag on the title bar itself, not its buttons
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOrigin.current) return
    const dx = e.clientX - dragOrigin.current.mx
    const dy = e.clientY - dragOrigin.current.my
    setPos({
      x: Math.max(0, dragOrigin.current.px + dx),
      y: Math.max(0, dragOrigin.current.py + dy),
    })
  }, [])

  const onPointerUp = useCallback(() => {
    dragOrigin.current = null
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width,
        zIndex,
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Title bar — drag target */}
      <div
        ref={titleBarRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: minimized ? 'none' : '1px solid var(--hairline)',
          cursor: 'grab',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 'var(--fs-200)',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            pointerEvents: 'none',
          }}
        >
          {title}
        </span>

        <button
          onClick={() => setMinimized((m) => !m)}
          style={iconBtnStyle}
          title={minimized ? 'Expand' : 'Minimize'}
        >
          {minimized ? <ChevronLeft size={12} /> : <Minus size={12} />}
        </button>

        {onClose && (
          <button onClick={onClose} style={iconBtnStyle} title="Close">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body — collapses when minimized */}
      <AnimatePresence initial={false}>
        {!minimized && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '10px 12px 12px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: 'var(--r-xs)',
  border: 'none',
  background: 'transparent',
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: 0,
  transition: 'background 120ms, color 120ms',
}

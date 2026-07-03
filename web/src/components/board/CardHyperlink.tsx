/**
 * Sigil — Log card hyperlinks (§59)
 *
 * Wraps a card name in the action log so that hover/click explodes
 * the Inspect modal. Reuses InspectModal from Phase 2.
 *
 * Usage (in a log renderer):
 *   <CardHyperlink name="Sol Ring" />
 */
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

interface Props {
  name: string
  cardId?: string
}

export default function CardHyperlink({ name, cardId }: Props) {
  const [hovered, setHovered] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setUI = useGameStore((s) => s.setUI)
  const imagesById = useGameStore((s) => s.imagesById)

  // Find image by cardId or by matching name in imagesById
  const meta = cardId
    ? imagesById[cardId]
    : Object.values(imagesById).find((m) => m.name === name)

  const openInspect = () => {
    if (cardId) {
      setUI({ inspectCardId: cardId })
    }
  }

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setHovered(true), 280)
  }
  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setHovered(false)
  }

  return (
    <span className="relative inline-block">
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={openInspect}
        className="font-medium underline underline-offset-2 decoration-dotted transition-colors"
        style={{
          color: 'var(--brand-bright)',
          textDecorationColor: 'rgba(77,163,255,0.5)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
        }}
      >
        {name}
      </button>

      <AnimatePresence>
        {hovered && meta?.img && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
            style={{ width: 150 }}
          >
            <img
              src={meta.img}
              alt={name}
              style={{
                width: '100%',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

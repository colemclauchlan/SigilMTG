// web/src/components/dice/Dice3D.tsx
// §61 — CSS/framer-motion 3D dice roll (no three.js dep needed; high-quality fallback).
// Animates a tumbling die across the screen, lands on result, then fades.
// TODO: upgrade to @react-three/fiber for full WebGL when three.js is available.

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type DieSides = 2 | 4 | 6 | 8 | 10 | 12 | 20 | 100

interface Props {
  sides: DieSides
  result: number          // pre-computed result passed in
  onComplete?: () => void // called after fade-out
}

// Pip layouts for d6 faces (dots); other dice show numeral faces
const D6_PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
}

function DieFace({ sides, value, size }: { sides: DieSides; value: number; size: number }) {
  const s = size
  if (sides === 6 && D6_PIPS[value]) {
    const pips = D6_PIPS[value] ?? []
    const pipR = s * 0.07
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
        <rect x={2} y={2} width={s - 4} height={s - 4} rx={s * 0.14}
          fill="var(--ink-2)" stroke="var(--brand)" strokeWidth={1.5} />
        {pips.map(([cx, cy], i) => (
          <circle key={i} cx={s * cx / 100} cy={s * cy / 100} r={pipR}
            fill="var(--brand-bright)" />
        ))}
      </svg>
    )
  }
  // Polygon/numeral face for non-d6
  const poly = diePolygon(sides, s)
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
      {poly && <polygon points={poly} fill="var(--ink-2)" stroke="var(--brand)" strokeWidth={1.5} />}
      <text
        x={s / 2} y={s / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={sides === 100 ? s * 0.22 : s * 0.3}
        fontWeight={700}
        fontFamily="'Inter', sans-serif"
        fill="var(--brand-bright)"
      >
        {value}
      </text>
    </svg>
  )
}

function diePolygon(sides: DieSides, s: number): string | null {
  const cx = s / 2, cy = s / 2, r = s * 0.45
  if (sides === 4) {
    // Triangle
    return [0, 1, 2].map(i => {
      const a = (i * Math.PI * 2 / 3) - Math.PI / 2
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    }).join(' ')
  }
  if (sides === 8 || sides === 10 || sides === 12 || sides === 20) {
    // Octagon approximation for all poly dice
    const n = sides === 8 ? 8 : sides === 10 ? 10 : sides === 12 ? 6 : 5
    return Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2 / n) - Math.PI / 2
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    }).join(' ')
  }
  // d6, d2, d100 → square/circle handled above
  return null
}

// Random roll animation frames
function randomFrame(sides: DieSides) {
  return Math.floor(Math.random() * sides) + 1
}

export function Dice3D({ sides, result, onComplete }: Props) {
  const [visible, setVisible]         = useState(true)
  const [rolling,  setRolling]         = useState(true)
  const [display,  setDisplay]         = useState(randomFrame(sides))
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Flash random faces rapidly, then settle on result
    let count = 0
    const totalFlashes = 14
    const interval = 60

    const flash = () => {
      count++
      if (count < totalFlashes) {
        setDisplay(randomFrame(sides))
        frameRef.current = setTimeout(flash, interval + count * 6) // slowing down
      } else {
        setDisplay(result)
        setRolling(false)
        // Fade out after pause
        setTimeout(() => setVisible(false), 1400)
      }
    }
    frameRef.current = setTimeout(flash, interval)
    return () => { if (frameRef.current) clearTimeout(frameRef.current) }
  }, [sides, result])

  const SIZE = 80

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -120, y: 40, rotate: -180, scale: 0.5 }}
          animate={{
            opacity: 1,
            x: 0,
            y: 0,
            rotate: rolling ? [null, 360, 720] : 0,
            scale: rolling ? [null, 1.1, 1] : 1,
          }}
          exit={{ opacity: 0, y: 20, scale: 0.85 }}
          transition={{
            duration: rolling ? 0.9 : 0.3,
            ease: [0.16, 1, 0.3, 1],
            rotate: { duration: 0.9, ease: 'easeOut', repeat: 0 },
          }}
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            filter: rolling ? 'drop-shadow(0 0 12px var(--brand))' : 'none',
            transition: 'filter 0.4s',
          }}
        >
          <DieFace sides={sides} value={display} size={SIZE} />
          {!rolling && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-display font-bold tracking-widest uppercase"
              style={{ color: 'var(--brand-bright)' }}
            >
              d{sides} → {result}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Overlay wrapper (centers the die in the viewport) ─────────────────────────
interface DiceOverlayProps {
  sides: DieSides
  result: number
  onComplete?: () => void
}

export function DiceOverlay({ sides, result, onComplete }: DiceOverlayProps) {
  return (
    <div
      className="fixed inset-0 pointer-events-none flex items-center justify-center z-[300]"
    >
      <Dice3D sides={sides} result={result} onComplete={onComplete} />
    </div>
  )
}

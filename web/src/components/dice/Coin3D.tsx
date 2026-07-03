// web/src/components/dice/Coin3D.tsx
// §61 — CSS/framer-motion 3D coin flip animation.
// Shows a spinning coin that lands heads or tails, then fades.
// TODO: upgrade to @react-three/fiber for WebGL when three.js is available.

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  result: 'heads' | 'tails'
  onComplete?: () => void
}

const SIZE = 80

function CoinFace({ face }: { face: 'heads' | 'tails' | 'edge' }) {
  if (face === 'edge') {
    return (
      <svg width={SIZE} height={SIZE} viewBox="0 0 80 80">
        <ellipse cx={40} cy={40} rx={38} ry={14}
          fill="var(--ink-3)" stroke="var(--brand)" strokeWidth={1.5} />
        <text x={40} y={44} textAnchor="middle" dominantBaseline="middle"
          fontSize={9} fontWeight={700} fontFamily="'Inter',sans-serif"
          fill="var(--brand-bright)">SIGIL</text>
      </svg>
    )
  }
  const isHeads = face === 'heads'
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 80 80">
      <circle cx={40} cy={40} r={38}
        fill={isHeads ? 'var(--brand-soft)' : 'var(--ink-3)'}
        stroke="var(--brand)" strokeWidth={2} />
      {/* Outer ring detail */}
      <circle cx={40} cy={40} r={33}
        fill="none" stroke="var(--brand)" strokeWidth={0.5} opacity={0.4} />
      {isHeads ? (
        /* Heads: Sigil "S" glyph */
        <>
          <text x={40} y={36} textAnchor="middle" dominantBaseline="middle"
            fontSize={22} fontWeight={800} fontFamily="'Cinzel',serif"
            fill="var(--brand-bright)">S</text>
          <text x={40} y={54} textAnchor="middle" dominantBaseline="middle"
            fontSize={7} fontWeight={700} fontFamily="'Inter',sans-serif"
            letterSpacing={2} fill="var(--brand)">HEADS</text>
        </>
      ) : (
        /* Tails: crossed swords icon */
        <>
          <line x1={26} y1={26} x2={54} y2={54} stroke="var(--brand-bright)" strokeWidth={3} strokeLinecap="round" />
          <line x1={54} y1={26} x2={26} y2={54} stroke="var(--brand-bright)" strokeWidth={3} strokeLinecap="round" />
          <text x={40} y={60} textAnchor="middle" dominantBaseline="middle"
            fontSize={7} fontWeight={700} fontFamily="'Inter',sans-serif"
            letterSpacing={2} fill="var(--brand)">TAILS</text>
        </>
      )}
    </svg>
  )
}

export function Coin3D({ result, onComplete }: Props) {
  const [visible,  setVisible]  = useState(true)
  const [spinning, setSpinning] = useState(true)
  const [face,     setFace]     = useState<'heads' | 'tails' | 'edge'>('edge')

  useEffect(() => {
    // Spin sequence: rapid face toggles then settle
    let count = 0
    const totalFlips = 16
    const baseMs = 55

    const flip = () => {
      count++
      if (count < totalFlips) {
        setFace(count % 2 === 0 ? 'heads' : 'tails')
        setTimeout(flip, baseMs + count * 8)
      } else {
        setFace(result)
        setSpinning(false)
        setTimeout(() => setVisible(false), 1600)
      }
    }
    setTimeout(flip, baseMs)
  }, [result])

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -60, rotateY: 0 }}
          animate={{
            opacity: 1,
            y: 0,
            rotateY: spinning ? [0, 180, 360, 540, 720] : 0,
          }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          transition={{
            duration: spinning ? 1.1 : 0.3,
            ease: [0.16, 1, 0.3, 1],
            rotateY: { duration: 1.1, ease: 'easeOut' },
          }}
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            perspective: '400px',
            filter: spinning ? 'drop-shadow(0 0 14px var(--brand))' : 'none',
            transition: 'filter 0.4s',
          }}
        >
          <motion.div
            animate={{ rotateY: spinning ? [0, 90, 180, 270, 360] : 0 }}
            transition={{ duration: 0.12, repeat: spinning ? Infinity : 0 }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <CoinFace face={face} />
          </motion.div>
          {!spinning && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-display font-bold tracking-widest uppercase"
              style={{ color: result === 'heads' ? 'var(--brand-bright)' : 'var(--muted)' }}
            >
              {result === 'heads' ? 'Heads!' : 'Tails!'}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Overlay wrapper ───────────────────────────────────────────────────────────
interface CoinOverlayProps {
  result: 'heads' | 'tails'
  onComplete?: () => void
}

export function CoinOverlay({ result, onComplete }: CoinOverlayProps) {
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[300]">
      <Coin3D result={result} onComplete={onComplete} />
    </div>
  )
}

/**
 * DeadOverlay — grey-out + "DEAD!" popup when life ≤ 0 (§5 #48).
 * Sits at z-index 350, covers the board, player can still dismiss/view log.
 */
import { motion } from 'framer-motion'

interface DeadOverlayProps {
  playerName: string
  onDismiss?: () => void
}

export default function DeadOverlay({ playerName, onDismiss }: DeadOverlayProps) {
  return (
    <motion.div
      key="dead-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 350,
        background: 'rgba(7, 13, 26, 0.78)',
        backdropFilter: 'grayscale(0.85) blur(2px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        pointerEvents: 'auto',
      }}
    >
      {/* Skull */}
      <motion.div
        initial={{ scale: 0.4, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        style={{ fontSize: 80, lineHeight: 1 }}
      >
        💀
      </motion.div>

      {/* DEAD! text */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2.5rem, 6vw, 5rem)',
          fontWeight: 800,
          color: 'var(--danger)',
          letterSpacing: '0.12em',
          textShadow: '0 0 40px rgba(224,101,92,0.55)',
          textTransform: 'uppercase',
        }}
      >
        DEAD!
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.22 }}
        style={{
          fontSize: 'var(--fs-300)',
          color: 'var(--muted)',
          fontFamily: 'var(--font-body)',
          margin: 0,
        }}
      >
        {playerName} has been eliminated
      </motion.p>

      {onDismiss && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={onDismiss}
          style={{
            marginTop: 10,
            padding: '9px 24px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--hairline)',
            background: 'var(--ink-2)',
            color: 'var(--muted)',
            fontSize: 'var(--fs-200)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Dismiss
        </motion.button>
      )}
    </motion.div>
  )
}

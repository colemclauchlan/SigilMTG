/**
 * Sigil — Reconnect/resume indicator (§57)
 * Shows a toast-style banner when Colyseus reconnects after a drop.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi } from 'lucide-react'

interface Props {
  visible: boolean
}

export default function ReconnectBanner({ visible }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-2.5 text-sm font-bold"
          style={{
            borderRadius: 'var(--r-lg)',
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.4)',
            color: 'var(--success)',
            backdropFilter: 'blur(12px)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <Wifi size={15} />
          Reconnected
        </motion.div>
      )}
    </AnimatePresence>
  )
}

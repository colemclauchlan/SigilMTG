/**
 * Sigil — Spectator mode indicator (§56)
 * A top banner shown when the local user is watching a game read-only.
 */
import { Eye } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SpectatorBanner() {
  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-1.5 text-xs font-bold tracking-widest uppercase"
      style={{
        background: 'rgba(77,163,255,0.12)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(77,163,255,0.3)',
        color: 'var(--brand-bright)',
      }}
    >
      <Eye size={13} />
      Spectating — read only
    </motion.div>
  )
}

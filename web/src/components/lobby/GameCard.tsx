/**
 * Sigil — Lobby game card (§54)
 * Shows open table info: name, host, seat count, suggested bracket, join/spectate.
 */
import { motion } from 'framer-motion'
import { Users, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BRACKET_COLORS: Record<number, string> = {
  1: '#a3cfbb', 2: '#7ec8e3', 3: '#f7c59f', 4: '#e07b54', 5: '#c94040',
}
const BRACKET_NAMES: Record<number, string> = {
  1: 'Exhibition', 2: 'Core', 3: 'Upgraded', 4: 'Optimized', 5: 'cEDH',
}

export interface OpenGame {
  id: string
  name: string
  host_name: string
  seats: number
  player_count: number
  avg_bracket: number | null
  status: 'open' | 'in_progress'
  created_at: string
}

interface Props {
  game: OpenGame
  index: number
}

export default function GameCard({ game, index }: Props) {
  const navigate = useNavigate()
  const isFull = game.player_count >= game.seats
  const bracketColor = game.avg_bracket != null ? BRACKET_COLORS[Math.round(game.avg_bracket)] : 'var(--faint)'
  const bracketName  = game.avg_bracket != null ? BRACKET_NAMES[Math.round(game.avg_bracket)] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-4 px-4 py-3"
      style={{
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--hairline)',
        background: 'var(--ink-3)',
      }}
    >
      {/* Bracket badge */}
      {game.avg_bracket != null && (
        <div
          className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm"
          style={{ background: `${bracketColor}22`, color: bracketColor, border: `1.5px solid ${bracketColor}` }}
        >
          B{Math.round(game.avg_bracket)}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--paper)' }}>{game.name}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          by {game.host_name}
          {bracketName && <span style={{ color: bracketColor }} className="ml-2">· {bracketName}</span>}
        </p>
      </div>

      {/* Seat count */}
      <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--muted)' }}>
        <Users size={13} />
        <span className="text-xs font-bold">
          {game.player_count}/{game.seats}
        </span>
      </div>

      {/* Actions */}
      {game.status === 'in_progress' ? (
        <button
          onClick={() => navigate(`/lobby/${game.id}?spectate=1`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold tracking-wide"
          style={{
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--hairline)',
            color: 'var(--muted)',
          }}
        >
          <Eye size={12} /> Watch
        </button>
      ) : (
        <button
          disabled={isFull}
          onClick={() => navigate(`/lobby/${game.id}`)}
          className="px-3 py-1.5 text-xs font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            borderRadius: 'var(--r-sm)',
            background: isFull ? 'var(--ink-3)' : 'linear-gradient(135deg, var(--brand-bright), var(--brand))',
            color: isFull ? 'var(--faint)' : '#04101f',
            border: isFull ? '1px solid var(--hairline)' : 'none',
          }}
        >
          {isFull ? 'Full' : 'Join'}
        </button>
      )}
    </motion.div>
  )
}

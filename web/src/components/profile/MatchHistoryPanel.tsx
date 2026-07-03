/**
 * Sigil — Match History panel (§53)
 * Shows recent games with W/L, ELO delta, commander, bracket, date.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Skull, TrendingUp, TrendingDown } from 'lucide-react'
import { fetchMatchHistory, type MatchRecord } from '../../lib/matchHistory'
import { formatEloDelta } from '../../lib/elo'

interface Props {
  userId: string
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const BRACKET_COLORS: Record<number, string> = {
  1: '#a3cfbb', 2: '#7ec8e3', 3: '#f7c59f', 4: '#e07b54', 5: '#c94040',
}

export default function MatchHistoryPanel({ userId }: Props) {
  const [records, setRecords] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchMatchHistory(userId, 20).then((r) => {
      setRecords(r)
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: 'var(--muted)' }}>
        Loading history…
      </div>
    )
  }

  if (!records.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <Trophy size={32} style={{ color: 'var(--faint)' }} />
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No games played yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {records.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 px-4 py-3"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--ink-3)',
            border: '1px solid var(--hairline)',
          }}
        >
          {/* W/L icon */}
          <div
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center"
            style={{
              borderRadius: '50%',
              background: r.won ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.12)',
            }}
          >
            {r.won
              ? <Trophy size={14} color="var(--success)" />
              : <Skull size={14} color="var(--danger)" />}
          </div>

          {/* Commander name */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--paper)' }}>
              {r.commander_name ?? 'Unknown Commander'}
            </p>
            <p className="text-xs" style={{ color: 'var(--faint)' }}>
              {relativeDate(r.created_at)}
              {r.bracket != null && (
                <span
                  className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: `${BRACKET_COLORS[r.bracket]}22`,
                    color: BRACKET_COLORS[r.bracket],
                  }}
                >
                  B{r.bracket}
                </span>
              )}
            </p>
          </div>

          {/* ELO delta */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {r.elo_delta >= 0
              ? <TrendingUp size={13} color="var(--success)" />
              : <TrendingDown size={13} color="var(--danger)" />}
            <span
              className="text-xs font-bold"
              style={{ color: r.elo_delta >= 0 ? 'var(--success)' : 'var(--danger)' }}
            >
              {formatEloDelta(r.elo_delta)}
            </span>
            <span className="text-xs" style={{ color: 'var(--faint)' }}>
              → {r.elo_after}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

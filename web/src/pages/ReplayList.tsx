/**
 * web/src/pages/ReplayList.tsx — User's recent replays (#82)
 * Route: /replays
 *
 * Lists the current user's saved replays from match_replays, linking
 * each to /replay/:id for the VOD player.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Film, Play, Trophy, Users, Clock, LogIn } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchReplays, type ReplayRow } from '../lib/replays'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0)  return `${mins}m ago`
  return 'just now'
}

function ReplayCard({ row, onClick }: { row: ReplayRow; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  const winner = row.players.find(p => p.seat === row.winner_seat)
  const stepCount = (row.intent_log ?? []).length

  return (
    <motion.button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      style={{
        background: hovered ? 'var(--ink-3)' : 'var(--ink)',
        border: `1px solid ${hovered ? 'var(--brand)' : 'var(--hairline)'}`,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 8,
        textAlign: 'left', cursor: 'pointer', width: '100%',
        transition: 'border-color 0.15s, background 0.15s',
        boxShadow: hovered ? 'var(--glow)' : 'none',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Film size={14} style={{ color: 'var(--brand-bright)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--paper)', flex: 1 }}>
          {row.players.map(p => p.displayName).join(' · ')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          {timeAgo(row.created_at)}
        </span>
      </div>

      {/* Info row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {winner && (
          <span style={{ fontSize: 11, color: 'var(--brand-bright)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trophy size={11} /> {winner.displayName} won
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Users size={11} /> {row.players.length} players
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> {stepCount} actions
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: hovered ? 'var(--brand-bright)' : 'var(--muted)',
          display: 'flex', alignItems: 'center', gap: 4,
          transition: 'color 0.15s',
        }}>
          <Play size={10} /> Watch
        </span>
      </div>
    </motion.button>
  )
}

export default function ReplayList() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [rows, setRows]       = useState<ReplayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    fetchReplays(user.id, 30).then(data => {
      setRows(data)
      setLoading(false)
    }).catch(err => {
      setError(String(err))
      setLoading(false)
    })
  }, [user?.id])

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 24px' }}>
        <Film size={36} style={{ color: 'var(--brand-bright)', opacity: 0.5 }} />
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Sign in to see your replays.</p>
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'var(--brand-soft)', border: '1px solid var(--brand)',
            borderRadius: 8, color: 'var(--brand-bright)', fontSize: 13,
            fontWeight: 700, padding: '8px 18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <LogIn size={14} /> Sign In
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Film size={18} style={{ color: 'var(--brand-bright)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--paper)', margin: 0, letterSpacing: '0.05em' }}>
          Replays
        </h1>
        {!loading && rows.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            background: 'var(--ink-3)', border: '1px solid var(--hairline)',
            borderRadius: 99, padding: '2px 8px', color: 'var(--muted)',
          }}>
            {rows.length}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}
        >
          Loading…
        </motion.div>
      ) : error ? (
        <p style={{ color: '#ff4444', fontSize: 13 }}>{error}</p>
      ) : rows.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          padding: '48px 0', color: 'var(--muted)',
        }}>
          <Film size={32} style={{ opacity: 0.25 }} />
          <p style={{ fontSize: 13, margin: 0 }}>No replays yet. Finish a multiplayer game to generate one.</p>
          <button
            onClick={() => navigate('/lobby')}
            style={{
              background: 'var(--brand-soft)', border: '1px solid var(--brand)',
              borderRadius: 8, color: 'var(--brand-bright)', fontSize: 13,
              fontWeight: 700, padding: '8px 18px', cursor: 'pointer',
            }}
          >
            Find a Game
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(row => (
            <ReplayCard
              key={row.id}
              row={row}
              onClick={() => navigate(`/replay/${row.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

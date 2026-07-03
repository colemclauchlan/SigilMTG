/**
 * Sigil — Watch page (/watch)
 *
 * Browse ongoing public games as cards (player count, avg bracket, watcher count).
 * "Watch" button → /watch/:gameId (SpectatorView).
 *
 * Data source: Supabase `games` table, status = 'in_progress'.
 * Realtime subscription refreshes the list as games start/end.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, Users, RefreshCw, Radio } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BRACKET_COLORS: Record<number, string> = {
  1: '#a3cfbb', 2: '#7ec8e3', 3: '#f7c59f', 4: '#e07b54', 5: '#c94040',
}
const BRACKET_NAMES: Record<number, string> = {
  1: 'Exhibition', 2: 'Core', 3: 'Upgraded', 4: 'Optimized', 5: 'cEDH',
}

interface OngoingGame {
  id: string
  name: string
  host_name: string
  seats: number
  player_count: number
  avg_bracket: number | null
  status: string
  created_at: string
}

function timeSince(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

interface GameWatchCardProps {
  game: OngoingGame
  index: number
}

function GameWatchCard({ game, index }: GameWatchCardProps) {
  const navigate = useNavigate()
  const bracketNum = game.avg_bracket != null ? Math.round(game.avg_bracket) : null
  const bracketColor = bracketNum != null ? (BRACKET_COLORS[bracketNum] ?? 'var(--faint)') : 'var(--faint)'
  const bracketName  = bracketNum != null ? (BRACKET_NAMES[bracketNum] ?? null) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-4 px-4 py-3"
      style={{
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--hairline)',
        background: 'var(--ink-3)',
      }}
    >
      {/* Bracket badge */}
      <div
        className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm"
        style={{
          background: `${bracketColor}22`,
          color: bracketColor,
          border: `1.5px solid ${bracketColor}`,
        }}
      >
        {bracketNum != null ? `B${bracketNum}` : '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--paper)' }}>
          {game.name}
        </p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          by {game.host_name}
          {bracketName && (
            <span style={{ color: bracketColor }} className="ml-2">
              · {bracketName}
            </span>
          )}
          <span className="ml-2">{timeSince(game.created_at)}</span>
        </p>
      </div>

      {/* Player count */}
      <div
        className="flex items-center gap-1 flex-shrink-0 text-xs font-bold"
        style={{ color: 'var(--muted)' }}
      >
        <Users size={12} />
        {game.player_count}/{game.seats}
      </div>

      {/* LIVE badge */}
      <div
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded-sm"
        style={{
          background: 'rgba(255, 80, 80, 0.12)',
          color: '#ff5050',
          border: '1px solid rgba(255,80,80,0.3)',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5050] animate-pulse" />
        LIVE
      </div>

      {/* Watch button */}
      <button
        onClick={() => navigate(`/watch/${game.id}`)}
        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold tracking-wide flex-shrink-0"
        style={{
          borderRadius: 'var(--r-sm)',
          background: 'linear-gradient(135deg, var(--brand-bright), var(--brand))',
          color: '#04101f',
        }}
      >
        <Eye size={12} /> Watch
      </button>
    </motion.div>
  )
}

export default function Watch() {
  const [games, setGames]   = useState<OngoingGame[]>([])
  const [loading, setLoading] = useState(true)

  const loadGames = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(30)
    setGames((data ?? []) as OngoingGame[])
    setLoading(false)
  }, [])

  useEffect(() => { loadGames() }, [loadGames])

  // Realtime: refresh when games table changes
  useEffect(() => {
    const channel = supabase
      .channel('watch-ongoing-games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        loadGames()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadGames])

  return (
    <div className="flex flex-col min-h-[calc(100dvh-62px)] max-w-2xl mx-auto px-4 py-8 gap-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center"
            style={{ borderRadius: 'var(--r-md)', background: 'rgba(255,80,80,0.12)' }}
          >
            <Radio size={20} color="#ff5050" strokeWidth={1.5} />
          </div>
          <div>
            <h1
              className="font-display font-bold text-2xl tracking-wide"
              style={{ color: 'var(--paper)' }}
            >
              Watch
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Live Commander games in progress
            </p>
          </div>
        </div>

        <button
          onClick={loadGames}
          className="w-9 h-9 flex items-center justify-center rounded-sm transition-colors"
          style={{
            color: 'var(--muted)',
            border: '1px solid var(--hairline)',
            background: 'var(--ink-3)',
          }}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </motion.div>

      {/* Game list */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <div
            className="flex items-center justify-center py-16"
            style={{ color: 'var(--muted)' }}
          >
            Loading…
          </div>
        ) : games.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
          >
            <Eye size={36} style={{ color: 'var(--faint)' }} />
            <div>
              <p className="font-bold mb-1" style={{ color: 'var(--paper)' }}>
                No games in progress
              </p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Check back when a game has started, or head to the Lobby to join one.
              </p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence>
            {games.map((g, i) => (
              <GameWatchCard key={g.id} game={g} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

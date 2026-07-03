/**
 * Sigil — Lobby page (§54, §56)
 *
 * Lists open and in-progress games from Supabase `games` table.
 * Host a Table → CreateGameModal → /lobby/:gameId
 * Join → /lobby/:gameId
 * Watch → /lobby/:gameId?spectate=1
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Plus, RefreshCw, Swords, Eye } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import GameCard, { type OpenGame } from '../components/lobby/GameCard'
import CreateGameModal from '../components/lobby/CreateGameModal'

const SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567'

export default function Lobby() {
  const { user, isGuest, playerName } = useAuth()
  const [games, setGames]               = useState<OpenGame[]>([])
  const [loading, setLoading]           = useState(true)
  const [showCreate, setShowCreate]     = useState(false)
  const [tab, setTab]                   = useState<'open' | 'ongoing'>('open')
  const navigate                          = useNavigate()

  const loadGames = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('games')
      .select('*')
      .in('status', tab === 'open' ? ['open'] : ['in_progress'])
      .order('created_at', { ascending: false })
      .limit(30)
    setGames((data ?? []) as OpenGame[])
    setLoading(false)
  }, [tab])

  useEffect(() => { loadGames() }, [loadGames])

  // Realtime subscription — refresh when games table changes
  useEffect(() => {
    const channel = supabase
      .channel('lobby-games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        loadGames()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadGames])

  const canHost = user || isGuest

  return (
    <div
      className="flex flex-col min-h-[calc(100dvh-62px)] max-w-2xl mx-auto px-4 py-8 gap-6"
    >
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
            style={{ borderRadius: 'var(--r-md)', background: 'var(--brand-soft)' }}
          >
            <Swords size={20} color="var(--brand-bright)" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl tracking-wide" style={{ color: 'var(--paper)' }}>
              Lobby
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Find a table or host your own
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadGames}
            className="w-9 h-9 flex items-center justify-center rounded-sm transition-colors"
            style={{ color: 'var(--muted)', border: '1px solid var(--hairline)', background: 'var(--ink-3)' }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => canHost ? setShowCreate(true) : null}
            disabled={!canHost}
            className="flex items-center gap-2 px-4 py-2 font-bold text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderRadius: 'var(--r-md)',
              background: 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))',
              color: '#04101f',
            }}
          >
            <Plus size={14} /> Host
          </button>
        </div>
      </motion.div>

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1"
        style={{ borderRadius: 'var(--r-md)', background: 'var(--ink-3)' }}
      >
        {(['open', 'ongoing'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold tracking-widest uppercase transition-all"
            style={{
              borderRadius: 'var(--r-sm)',
              background: tab === t ? 'var(--ink)' : 'transparent',
              color: tab === t ? 'var(--brand-bright)' : 'var(--muted)',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t === 'open' ? <><Users size={11} /> Open Tables</> : <><Eye size={11} /> Ongoing</>}
          </button>
        ))}
      </div>

      {/* Game list */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
            Loading…
          </div>
        ) : games.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 gap-4 text-center"
          >
            <Users size={36} style={{ color: 'var(--faint)' }} />
            <div>
              <p className="font-bold mb-1" style={{ color: 'var(--paper)' }}>
                {tab === 'open' ? 'No open tables' : 'No games in progress'}
              </p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {tab === 'open'
                  ? 'Be the first to host a table!'
                  : 'Browse live games on the Watch page.'}
              </p>
              {tab === 'ongoing' && (
                <button
                  onClick={() => navigate('/watch')}
                  className="flex items-center gap-2 px-5 py-2.5 font-bold text-sm"
                  style={{
                    borderRadius: 'var(--r-md)',
                    background: 'linear-gradient(135deg, rgba(77,163,255,0.15), rgba(77,163,255,0.08))',
                    color: 'var(--brand-bright)',
                    border: '1px solid rgba(77,163,255,0.3)',
                  }}
                >
                  <Eye size={14} /> Go to Watch
                </button>
              )}
            </div>
            {tab === 'open' && canHost && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-5 py-2.5 font-bold text-sm"
                style={{
                  borderRadius: 'var(--r-md)',
                  background: 'linear-gradient(135deg, var(--brand-bright), var(--brand))',
                  color: '#04101f',
                }}
              >
                <Plus size={14} /> Host a Table
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence>
            {games.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {!user && !isGuest && (
        <p className="text-xs text-center" style={{ color: 'var(--faint)' }}>
          Sign in or continue as guest to host a table.
        </p>
      )}

      {/* Create game modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateGameModal
            onClose={() => setShowCreate(false)}
            serverUrl={SERVER_URL}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

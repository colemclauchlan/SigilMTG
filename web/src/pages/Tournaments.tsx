/**
 * Sigil — Tournaments (§79)
 *
 * Routes:
 *   /tournaments       → list open/active + create button
 *   /tournaments/:id   → bracket/standings + pairing result reporting
 *
 * Renders against typed client even before migration is applied (empty state).
 * Format: Swiss or Single-Elimination, ELO-seeded pairings.
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Swords, Plus, Loader, Trophy, Users, ChevronRight,
  RefreshCw, Check, X, AlertCircle, Crown,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchTournaments,
  fetchTournamentDetail,
  fetchStandings,
  createTournament,
  joinTournament,
  dropFromTournament,
  seedByElo,
  generateRound,
  reportResult,
  finishTournament,
  type Tournament,
  type TournamentDetail,
  type TournamentFormat,
  type StandingsEntry,
  type TournamentPairing,
} from '../lib/tournaments'

// ── Shared styles ─────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  borderRadius: 'var(--r-xl)',
  border: '1px solid var(--hairline)',
  background: 'var(--glass)',
  backdropFilter: 'blur(16px)',
  padding: '20px 24px',
}

const STATUS_COLOR: Record<string, string> = {
  open: '#4ade80',
  active: '#facc15',
  finished: 'var(--muted)',
}

const FORMAT_LABEL: Record<TournamentFormat, string> = {
  swiss: 'Swiss',
  single_elim: 'Single Elim',
}

// ── Create tournament modal ───────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Tournament) => void }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('swiss')
  const [cap, setCap] = useState(8)
  const [working, setWorking] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 'var(--r-md)',
    background: 'var(--ink-3)', border: '1px solid var(--hairline)',
    color: 'var(--paper)', fontSize: '0.875rem', outline: 'none', width: '100%',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  const handleCreate = async () => {
    if (!user) { setErr('Sign in to create a tournament.'); return }
    if (!name.trim()) { setErr('Name is required.'); return }
    setWorking(true)
    const t = await createTournament(user.id, name.trim(), format, cap)
    setWorking(false)
    if (!t) { setErr('Could not create tournament. Migration may not be applied yet.'); return }
    onCreate(t)
    onClose()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      <motion.div
        initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }}
        transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
        className="relative z-10 w-full max-w-sm flex flex-col gap-4 rounded-2xl p-6"
        style={{ background: 'var(--ink)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base tracking-widest uppercase" style={{ color: 'var(--paper)' }}>
            New Tournament
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Name</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sigil Weekly #1"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Format</label>
            <select style={selectStyle} value={format} onChange={(e) => setFormat(e.target.value as TournamentFormat)}>
              <option value="swiss">Swiss</option>
              <option value="single_elim">Single Elimination</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Player Cap</label>
            <select style={selectStyle} value={cap} onChange={(e) => setCap(Number(e.target.value))}>
              {[4, 8, 16, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {err && (
          <p className="text-xs flex items-center gap-2" style={{ color: '#f87171' }}>
            <AlertCircle size={14} />{err}
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={working}
          className="w-full py-3 rounded-xl font-bold text-xs tracking-widest uppercase transition-all duration-200"
          style={{
            background: 'var(--brand)', color: 'var(--paper)',
            opacity: working ? 0.6 : 1,
          }}
        >
          {working ? 'Creating…' : 'Create Tournament'}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Tournament card in list ───────────────────────────────────────────────────
function TournamentCard({ t, onClick }: { t: Tournament; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left rounded-xl p-4 flex items-center gap-4 transition-all duration-150"
      style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--ink-3)' }}>
        <Trophy size={18} style={{ color: 'var(--brand-bright)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: 'var(--paper)' }}>{t.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          {FORMAT_LABEL[t.format as TournamentFormat]} · cap {t.bracket_cap}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
          style={{ color: STATUS_COLOR[t.status], background: 'var(--ink-3)', border: `1px solid ${STATUS_COLOR[t.status]}33` }}
        >
          {t.status}
        </span>
        <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
      </div>
    </motion.button>
  )
}

// ── Tournament list page ──────────────────────────────────────────────────────
function TournamentList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'open' | 'active' | 'all'>('open')

  const load = useCallback(async () => {
    setLoading(true)
    const status = filterStatus === 'all' ? undefined : filterStatus as 'open' | 'active'
    const data = await fetchTournaments(status)
    setTournaments(data)
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  const handleCreated = (t: Tournament) => {
    navigate(`/tournaments/${t.id}`)
  }

  const tabs = [
    { label: 'Open', value: 'open' as const },
    { label: 'Active', value: 'active' as const },
    { label: 'All', value: 'all' as const },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords size={24} style={{ color: 'var(--brand-bright)' }} />
            <h1
              className="font-display font-bold text-2xl tracking-widest uppercase"
              style={{
                background: 'linear-gradient(180deg, #eaf4ff, var(--brand-bright) 58%, var(--brand))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Tournaments
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg transition-colors duration-150"
              style={{ color: 'var(--muted)', background: 'var(--ink-2)' }}
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            {user && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all duration-150"
                style={{ background: 'var(--brand)', color: 'var(--paper)' }}
              >
                <Plus size={14} /> New
              </button>
            )}
          </div>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Swiss &amp; single-elimination pods, ELO-seeded</p>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--ink-3)' }}>
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilterStatus(t.value)}
            className="relative flex-1 py-2 px-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors duration-200"
            style={{ color: filterStatus === t.value ? 'var(--brand-bright)' : 'var(--muted)' }}
          >
            {filterStatus === t.value && (
              <motion.span
                layoutId="t-filter-bg"
                className="absolute inset-0 rounded-lg"
                style={{ background: 'var(--ink)', zIndex: -1 }}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
              />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--muted)' }}>
          <Loader size={18} className="animate-spin" /><span className="text-sm">Loading…</span>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center" style={{ color: 'var(--muted)' }}>
          <Swords size={36} style={{ opacity: 0.3 }} />
          <p className="font-bold text-sm tracking-widest uppercase">No tournaments found</p>
          {user
            ? <p className="text-xs">Create the first one!</p>
            : <p className="text-xs">Sign in to create or join a tournament.</p>
          }
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tournaments.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <TournamentCard t={t} onClick={() => navigate(`/tournaments/${t.id}`)} />
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />}
      </AnimatePresence>
    </div>
  )
}

// ── Pairing row ───────────────────────────────────────────────────────────────
function PairingRow({
  pairing,
  playerMap,
  myId,
  isOwner,
  onReport,
}: {
  pairing: TournamentPairing
  playerMap: Map<string, string>
  myId?: string
  isOwner: boolean
  onReport: (pairingId: string, winnerId: string) => void
}) {
  const [reporting, setReporting] = useState(false)
  const isBye = pairing.player_ids.length === 1

  if (isBye) {
    const pid = pairing.player_ids[0]
    return (
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg text-xs" style={{ background: 'var(--ink-3)' }}>
        <span className="w-6 text-right font-mono" style={{ color: 'var(--muted)' }}>BYE</span>
        <span style={{ color: 'var(--paper)' }}>{playerMap.get(pid) ?? pid.slice(0, 8)}</span>
        <span className="ml-auto text-[10px]" style={{ color: '#4ade80' }}>Auto-win</span>
      </div>
    )
  }

  const [p1, p2] = pairing.player_ids
  const canReport = !pairing.reported && (isOwner || pairing.player_ids.includes(myId ?? ''))

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg text-xs"
      style={{ background: reporting ? 'var(--ink-3)' : 'var(--ink-2)', border: '1px solid var(--hairline)' }}
    >
      <span className="w-4 font-mono" style={{ color: 'var(--muted)' }}>T{pairing.table_no}</span>
      <span className="flex-1 truncate" style={{ color: pairing.winner_profile_id === p1 ? '#4ade80' : 'var(--paper)' }}>
        {playerMap.get(p1) ?? p1.slice(0, 8)}
      </span>
      <span style={{ color: 'var(--muted)' }}>vs</span>
      <span className="flex-1 truncate text-right" style={{ color: pairing.winner_profile_id === p2 ? '#4ade80' : 'var(--paper)' }}>
        {playerMap.get(p2) ?? p2.slice(0, 8)}
      </span>

      {pairing.reported ? (
        <Check size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
      ) : canReport ? (
        <div className="flex gap-1 flex-shrink-0">
          {reporting ? (
            <>
              <button
                onClick={() => { setReporting(false); onReport(pairing.id, p1) }}
                className="px-2 py-1 rounded text-[10px] font-bold"
                style={{ background: '#16a34a22', color: '#4ade80', border: '1px solid #16a34a' }}
              >
                {playerMap.get(p1)?.slice(0, 6) ?? 'P1'} wins
              </button>
              <button
                onClick={() => { setReporting(false); onReport(pairing.id, p2) }}
                className="px-2 py-1 rounded text-[10px] font-bold"
                style={{ background: '#16a34a22', color: '#4ade80', border: '1px solid #16a34a' }}
              >
                {playerMap.get(p2)?.slice(0, 6) ?? 'P2'} wins
              </button>
              <button onClick={() => setReporting(false)} style={{ color: 'var(--muted)' }}>
                <X size={12} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setReporting(true)}
              className="px-2 py-1 rounded text-[10px] font-bold"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand-bright)', border: '1px solid var(--brand)' }}
            >
              Report
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ── Tournament detail page ─────────────────────────────────────────────────────
function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [standings, setStandings] = useState<StandingsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [tab, setTab] = useState<'rounds' | 'standings'>('rounds')

  const myId = user?.id
  const isOwner = detail?.owner_id === myId
  const isPlayer = detail?.players.some((p) => p.profile_id === myId) ?? false
  const isDropped = detail?.players.find((p) => p.profile_id === myId)?.dropped ?? false

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [d, s] = await Promise.all([
      fetchTournamentDetail(id),
      fetchStandings(id),
    ])
    setDetail(d)
    setStandings(s)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const playerMap = new Map<string, string>(
    (detail?.players ?? []).map((p) => [p.profile_id, p.display_name ?? p.profile_id.slice(0, 8)])
  )

  const handleJoin = async () => {
    if (!user || !id) return
    setWorking(true)
    await joinTournament(id, user.id)
    await load()
    setWorking(false)
  }

  const handleDrop = async () => {
    if (!user || !id) return
    setWorking(true)
    await dropFromTournament(id, user.id)
    await load()
    setWorking(false)
  }

  const handleSeedAndRound = async () => {
    if (!id || !detail) return
    setWorking(true)
    await seedByElo(id)
    await generateRound(id, detail.format as TournamentFormat)
    await load()
    setWorking(false)
  }

  const handleNextRound = async () => {
    if (!id || !detail) return
    setWorking(true)
    await generateRound(id, detail.format as TournamentFormat)
    await load()
    setWorking(false)
  }

  const handleFinish = async () => {
    if (!id) return
    setWorking(true)
    await finishTournament(id)
    await load()
    setWorking(false)
  }

  const handleReport = async (pairingId: string, winnerId: string) => {
    setWorking(true)
    await reportResult(pairingId, winnerId)
    await load()
    setWorking(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50dvh] gap-2" style={{ color: 'var(--muted)' }}>
        <Loader size={18} className="animate-spin" /><span>Loading tournament…</span>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4" style={{ color: 'var(--muted)' }}>
        <AlertCircle size={36} style={{ opacity: 0.4 }} />
        <p className="font-bold text-sm">Tournament not found or database migration not yet applied.</p>
        <NavLink to="/tournaments" className="text-xs underline" style={{ color: 'var(--brand-bright)' }}>Back to list</NavLink>
      </div>
    )
  }

  const allCurrentRoundReported = detail.rounds.length > 0
    ? detail.rounds[detail.rounds.length - 1].pairings.every((p) => p.reported)
    : false
  const canStartNextRound = isOwner && detail.status === 'active' && allCurrentRoundReported
  const canStartFirst = isOwner && detail.status === 'open' && detail.players.length >= 2

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <NavLink
          to="/tournaments"
          className="text-xs mb-3 inline-flex items-center gap-1.5"
          style={{ color: 'var(--muted)' }}
        >
          ← Tournaments
        </NavLink>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-xl" style={{ color: 'var(--paper)' }}>{detail.name}</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {FORMAT_LABEL[detail.format as TournamentFormat]} · cap {detail.bracket_cap} ·
              <span className="ml-1 font-bold" style={{ color: STATUS_COLOR[detail.status] }}>
                {detail.status.toUpperCase()}
              </span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {user && detail.status === 'open' && !isPlayer && (
              <button
                onClick={handleJoin}
                disabled={working}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-widest uppercase"
                style={{ background: 'var(--brand)', color: 'var(--paper)', opacity: working ? 0.6 : 1 }}
              >
                Join
              </button>
            )}
            {isPlayer && !isDropped && detail.status !== 'finished' && (
              <button
                onClick={handleDrop}
                disabled={working}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-widest uppercase"
                style={{ background: 'var(--ink-3)', color: '#f87171', border: '1px solid #f8717133', opacity: working ? 0.6 : 1 }}
              >
                Drop
              </button>
            )}
            {canStartFirst && (
              <button
                onClick={handleSeedAndRound}
                disabled={working}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-widest uppercase"
                style={{ background: '#facc1522', color: '#facc15', border: '1px solid #facc1544', opacity: working ? 0.6 : 1 }}
              >
                {working ? 'Starting…' : 'Seed & Start R1'}
              </button>
            )}
            {canStartNextRound && (
              <button
                onClick={handleNextRound}
                disabled={working}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-widest uppercase"
                style={{ background: '#facc1522', color: '#facc15', border: '1px solid #facc1544', opacity: working ? 0.6 : 1 }}
              >
                {working ? 'Generating…' : `Next Round (R${detail.rounds.length + 1})`}
              </button>
            )}
            {isOwner && detail.status === 'active' && (
              <button
                onClick={handleFinish}
                disabled={working}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-widest uppercase"
                style={{ background: 'var(--ink-3)', color: 'var(--muted)', border: '1px solid var(--hairline)', opacity: working ? 0.6 : 1 }}
              >
                End Tournament
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Players */}
      <div style={card}>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <Users size={14} /> Players ({detail.players.filter((p) => !p.dropped).length} / {detail.bracket_cap})
        </h3>
        {detail.players.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>No players joined yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {detail.players.map((p) => (
              <div
                key={p.profile_id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{
                  background: p.dropped ? 'var(--ink-3)' : 'var(--brand-soft)',
                  color: p.dropped ? 'var(--muted)' : 'var(--brand-bright)',
                  border: `1px solid ${p.dropped ? 'var(--hairline)' : 'var(--brand)33'}`,
                  textDecoration: p.dropped ? 'line-through' : 'none',
                  opacity: p.dropped ? 0.5 : 1,
                }}
              >
                {p.seed && <span className="font-mono opacity-70">#{p.seed}</span>}
                {p.display_name ?? p.profile_id.slice(0, 8)}
                {p.elo && <span className="opacity-60 font-mono">{p.elo}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rounds / Standings tabs */}
      {(detail.rounds.length > 0 || standings.length > 0) && (
        <>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--ink-3)' }}>
            {(['rounds', 'standings'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative flex-1 py-2 px-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors duration-200"
                style={{ color: tab === t ? 'var(--brand-bright)' : 'var(--muted)' }}
              >
                {tab === t && (
                  <motion.span layoutId="td-tab-bg" className="absolute inset-0 rounded-lg"
                    style={{ background: 'var(--ink)', zIndex: -1 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }} />
                )}
                {t === 'rounds' ? 'Rounds' : 'Standings'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'rounds' ? (
                <div className="flex flex-col gap-4">
                  {detail.rounds.map((round) => (
                    <div key={round.id} style={card}>
                      <h4 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>
                        Round {round.round_no}
                      </h4>
                      <div className="flex flex-col gap-2">
                        {round.pairings.map((p) => (
                          <PairingRow
                            key={p.id}
                            pairing={p}
                            playerMap={playerMap}
                            myId={myId}
                            isOwner={isOwner}
                            onReport={handleReport}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={card}>
                  <h3 className="text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                    <Crown size={14} /> Standings
                  </h3>
                  {standings.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>No results reported yet.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {standings.map((s, i) => (
                        <div
                          key={s.profile_id}
                          className="flex items-center gap-3 py-2 px-2 rounded-lg text-xs"
                          style={{ background: i === 0 ? 'rgba(250,204,21,0.08)' : 'transparent' }}
                        >
                          <span className="w-4 font-mono text-center" style={{ color: i === 0 ? '#facc15' : 'var(--muted)' }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                          </span>
                          <span className="flex-1 font-medium truncate" style={{ color: 'var(--paper)' }}>
                            {s.display_name}
                          </span>
                          <span className="font-mono" style={{ color: '#4ade80' }}>{s.wins}W</span>
                          <span className="font-mono" style={{ color: '#f87171' }}>{s.losses}L</span>
                          <span className="font-mono w-8 text-right" style={{ color: 'var(--brand-bright)' }}>{s.match_points}pts</span>
                          <span className="font-mono w-12 text-right" style={{ color: 'var(--muted)' }}>{s.elo} ELO</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function Tournaments() {
  const { id } = useParams<{ id?: string }>()
  return id ? <TournamentDetailPage /> : <TournamentList />
}

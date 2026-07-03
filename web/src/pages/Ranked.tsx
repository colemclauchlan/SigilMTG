/**
 * Sigil — Ranked Hub (§79, §83)
 *
 * Route: /ranked
 * Tabs: Leaderboard | Metagame
 *
 * §83 additions:
 *   - Season selector (All-time / active season) on the Leaderboard tab
 *   - "Season ends in Xd" banner when a season is active
 *   - Season-scoped standings from match_history window
 *
 * All charts are inline SVG — no recharts dependency.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, BarChart2, Loader, CalendarClock } from 'lucide-react'
import {
  fetchLeaderboard,
  fetchMetagame,
  type LeaderboardEntry,
  type MetagameData,
} from '../lib/rankings'
import {
  fetchSeasons,
  fetchActiveSeason,
  seasonCountdown,
  type Season,
} from '../lib/seasons'

// ── Shared styles ─────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  borderRadius: 'var(--r-xl)',
  border: '1px solid var(--hairline)',
  background: 'var(--glass)',
  backdropFilter: 'blur(16px)',
  padding: '20px 24px',
}

const TAB_LABELS = ['Leaderboard', 'Metagame'] as const
type Tab = typeof TAB_LABELS[number]

// ── Color constants for pie ───────────────────────────────────────────────────
const COLOR_HEX: Record<string, string> = {
  W: '#f8f0d8', U: '#3a7bd5', B: '#6b21a8', R: '#dc2626', G: '#16a34a', C: '#78716c',
}

// ── Tab pill ──────────────────────────────────────────────────────────────────
function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--ink-3)' }}>
      {TAB_LABELS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="relative flex-1 py-2 px-4 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors duration-200"
          style={{ color: active === t ? 'var(--brand-bright)' : 'var(--muted)', zIndex: 1 }}
        >
          {active === t && (
            <motion.span
              layoutId="ranked-tab-bg"
              className="absolute inset-0 rounded-lg"
              style={{ background: 'var(--ink)', zIndex: -1 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
            />
          )}
          {t}
        </button>
      ))}
    </div>
  )
}

// ── ELO badge ─────────────────────────────────────────────────────────────────
function EloBadge({ elo }: { elo: number }) {
  const color = elo >= 1400 ? 'var(--brand-bright)' : elo >= 1300 ? '#facc15' : 'var(--muted)'
  return (
    <span className="font-mono font-bold text-sm" style={{ color }}>
      {elo}
    </span>
  )
}

// ── Season banner ─────────────────────────────────────────────────────────────
function SeasonBanner({ season }: { season: Season }) {
  const countdown = seasonCountdown(season)
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
      style={{
        background: 'linear-gradient(135deg, var(--brand-soft) 0%, rgba(90,140,230,0.08) 100%)',
        border: '1px solid var(--brand-soft)',
        color: 'var(--brand-bright)',
      }}
    >
      <CalendarClock size={13} />
      <span className="font-bold">{season.name}</span>
      <span style={{ color: 'var(--muted)' }}>·</span>
      <span style={{ color: 'var(--paper-dim)' }}>{countdown}</span>
    </motion.div>
  )
}

// ── Season selector dropdown ──────────────────────────────────────────────────
interface SeasonOption {
  label: string
  value: 'all-time' | string  // 'all-time' or season.id
  season?: Season
}

function SeasonSelector({
  options,
  selected,
  onChange,
}: {
  options: SeasonOption[]
  selected: string
  onChange: (v: string) => void
}) {
  if (options.length <= 1) return null  // only "All-time" → nothing to switch
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs font-bold px-3 py-1.5 rounded-lg"
      style={{
        background: 'var(--ink-3)',
        border: '1px solid var(--hairline)',
        color: 'var(--paper)',
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [selectedValue, setSelectedValue] = useState<string>('all-time')

  // Load seasons on mount
  useEffect(() => {
    Promise.all([fetchSeasons(), fetchActiveSeason()]).then(([all, active]) => {
      setSeasons(all)
      setActiveSeason(active)
      // Default to the active season if one exists
      if (active) setSelectedValue(active.id)
    })
  }, [])

  // Reload leaderboard whenever selection changes
  useEffect(() => {
    setLoading(true)
    const found = seasons.find((s) => s.id === selectedValue)
    if (selectedValue === 'all-time' || !found) {
      fetchLeaderboard(50).then((d) => { setEntries(d); setLoading(false) })
    } else {
      fetchLeaderboard(50, found.starts_at, found.ends_at)
        .then((d) => { setEntries(d); setLoading(false) })
    }
  }, [selectedValue, seasons])

  // Build dropdown options
  const options: SeasonOption[] = [
    { label: 'All-time', value: 'all-time' },
    ...seasons.map((s) => ({ label: s.name, value: s.id, season: s })),
  ]

  const currentSeason = seasons.find((s) => s.id === selectedValue) ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2" style={{ color: 'var(--muted)' }}>
        <Loader size={18} className="animate-spin" />
        <span className="text-sm">Loading rankings…</span>
      </div>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="flex flex-col gap-3">
      {/* Season banner */}
      {activeSeason && <SeasonBanner season={activeSeason} />}

      <div style={card}>
        {/* Season selector header row */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
            {selectedValue === 'all-time' ? 'All-time standings' : `${currentSeason?.name ?? ''} standings`}
          </h3>
          <SeasonSelector options={options} selected={selectedValue} onChange={setSelectedValue} />
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center" style={{ color: 'var(--muted)' }}>
            <Trophy size={36} style={{ opacity: 0.3 }} />
            <p className="font-bold text-sm tracking-widest uppercase">
              {selectedValue === 'all-time' ? 'No ranked players yet' : 'No games played this season'}
            </p>
            <p className="text-xs max-w-xs">
              {selectedValue === 'all-time'
                ? 'Play your first game to appear on the leaderboard. ELO starts at 1200.'
                : 'Season standings are computed from games played within the season window.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="text-left text-xs font-bold tracking-widest uppercase pb-3 pr-4">#</th>
                  <th className="text-left text-xs font-bold tracking-widest uppercase pb-3 pr-4">Player</th>
                  <th className="text-right text-xs font-bold tracking-widest uppercase pb-3 pr-4">ELO</th>
                  <th className="text-right text-xs font-bold tracking-widest uppercase pb-3 pr-4">W</th>
                  <th className="text-right text-xs font-bold tracking-widest uppercase pb-3 pr-4">L</th>
                  <th className="text-right text-xs font-bold tracking-widest uppercase pb-3">Win%</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="border-t transition-colors duration-150 hover:bg-[var(--ink-3)]"
                    style={{ borderColor: 'var(--hairline)' }}
                  >
                    <td className="py-3 pr-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {i < 3 ? <span>{medals[i]}</span> : <span>{e.rank}</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'var(--brand-soft)', color: 'var(--brand-bright)' }}
                        >
                          {(e.display_name?.[0] ?? '?').toUpperCase()}
                        </div>
                        <span className="font-medium truncate max-w-[140px]" style={{ color: 'var(--paper)' }}>
                          {e.display_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right"><EloBadge elo={e.elo} /></td>
                    <td className="py-3 pr-4 text-right font-mono text-xs" style={{ color: '#4ade80' }}>{e.wins ?? 0}</td>
                    <td className="py-3 pr-4 text-right font-mono text-xs" style={{ color: '#f87171' }}>{e.losses ?? 0}</td>
                    <td className="py-3 text-right font-mono text-xs" style={{ color: 'var(--paper-dim)' }}>
                      {e.win_rate}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Metagame charts ───────────────────────────────────────────────────────────

function BracketBars({ data }: { data: MetagameData['bracketWinRates'] }) {
  if (data.length === 0) {
    return (
      <p className="text-xs py-4 text-center" style={{ color: 'var(--muted)' }}>
        No bracket data yet.
      </p>
    )
  }
  const labels = ['', 'Casual', 'Upgraded', 'Optimized', 'cEDH']
  return (
    <div className="flex flex-col gap-2">
      {data.map((b) => (
        <div key={b.bracket} className="flex items-center gap-3 text-xs">
          <span className="w-16 text-right flex-shrink-0" style={{ color: 'var(--muted)' }}>
            {labels[b.bracket] ?? `B${b.bracket}`}
          </span>
          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--ink-3)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--brand)' }}
              initial={{ width: 0 }}
              animate={{ width: `${b.win_rate}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="w-8 font-mono" style={{ color: 'var(--paper-dim)' }}>{b.win_rate}%</span>
          <span className="w-12 text-right" style={{ color: 'var(--muted)' }}>{b.games}g</span>
        </div>
      ))}
    </div>
  )
}

function ColorPie({ data }: { data: MetagameData['colorStats'] }) {
  const total = data.reduce((s, c) => s + c.count, 0)
  if (total === 0) {
    return (
      <p className="text-xs py-4 text-center" style={{ color: 'var(--muted)' }}>
        No color data yet.
      </p>
    )
  }

  const cx = 60, cy = 60, r = 52
  let angle = -90
  const slices: { color: string; label: string; pct: number; path: string }[] = []
  for (const c of data) {
    if (c.pct === 0) continue
    const deg = (c.pct / 100) * 360
    const rad1 = (angle * Math.PI) / 180
    const rad2 = ((angle + deg) * Math.PI) / 180
    const x1 = cx + r * Math.cos(rad1)
    const y1 = cy + r * Math.sin(rad1)
    const x2 = cx + r * Math.cos(rad2)
    const y2 = cy + r * Math.sin(rad2)
    const large = deg > 180 ? 1 : 0
    slices.push({
      color: COLOR_HEX[c.color] ?? '#888',
      label: c.label,
      pct: c.pct,
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
    })
    angle += deg
  }

  return (
    <div className="flex items-center gap-6">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="var(--ink)" strokeWidth="1.5" opacity={0.85} />
        ))}
      </svg>
      <div className="flex flex-col gap-1">
        {data.filter((c) => c.pct > 0).map((c) => (
          <div key={c.color} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLOR_HEX[c.color] }} />
            <span style={{ color: 'var(--paper-dim)' }}>{c.label}</span>
            <span className="font-mono ml-auto pl-3" style={{ color: 'var(--muted)' }}>{c.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CommanderTable({ data }: { data: MetagameData['topCommanders'] }) {
  if (data.length === 0) {
    return <p className="text-xs py-4 text-center" style={{ color: 'var(--muted)' }}>No commander data yet.</p>
  }
  return (
    <div className="flex flex-col gap-1">
      {data.slice(0, 8).map((c, i) => (
        <div
          key={c.name}
          className="flex items-center gap-3 py-1.5 px-2 rounded-md text-xs"
          style={{ background: i % 2 === 0 ? 'var(--ink-3)' : 'transparent' }}
        >
          <span className="w-4 text-right font-mono" style={{ color: 'var(--muted)' }}>{i + 1}</span>
          <span className="flex-1 truncate font-medium" style={{ color: 'var(--paper)' }}>{c.name}</span>
          <span className="font-mono" style={{ color: 'var(--muted)' }}>{c.games}g</span>
          <span className="font-mono w-10 text-right" style={{ color: '#4ade80' }}>{c.win_rate}%</span>
        </div>
      ))}
    </div>
  )
}

function Sparkline({ data }: { data: MetagameData['weeklyActivity'] }) {
  if (data.length < 2) {
    return <p className="text-xs py-4 text-center" style={{ color: 'var(--muted)' }}>Not enough activity data.</p>
  }
  const W = 260, H = 48, pad = 4
  const max = Math.max(...data.map((d) => d.games), 1)
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (W - pad * 2))
  const ys = data.map((d) => H - pad - ((d.games / max) * (H - pad * 2)))
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
      <polyline
        points={points}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r="3" fill="var(--brand-bright)" />
      ))}
    </svg>
  )
}

function Metagame() {
  const [meta, setMeta] = useState<MetagameData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetagame().then((d) => { setMeta(d); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2" style={{ color: 'var(--muted)' }}>
        <Loader size={18} className="animate-spin" />
        <span className="text-sm">Crunching metagame data…</span>
      </div>
    )
  }

  const noData = !meta || meta.totalGames === 0

  return (
    <div className="flex flex-col gap-4">
      {noData && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center" style={{ color: 'var(--muted)' }}>
          <BarChart2 size={36} style={{ opacity: 0.3 }} />
          <p className="font-bold text-sm tracking-widest uppercase">No metagame data yet</p>
          <p className="text-xs max-w-xs">After a few games, you'll see win-rates by bracket, color breakdowns, and top commanders.</p>
        </div>
      )}
      {!noData && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div style={card} className="text-center">
              <p className="text-2xl font-bold font-display" style={{ color: 'var(--brand-bright)' }}>{meta!.totalGames}</p>
              <p className="text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--muted)' }}>Total Games</p>
            </div>
            <div style={card} className="text-center">
              <p className="text-2xl font-bold font-display" style={{ color: 'var(--brand-bright)' }}>{meta!.topCommanders.length}</p>
              <p className="text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--muted)' }}>Unique Commanders</p>
            </div>
          </div>

          <div style={card}>
            <h3 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--muted)' }}>Win-Rate by Bracket</h3>
            <BracketBars data={meta!.bracketWinRates} />
          </div>

          <div style={card}>
            <h3 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--muted)' }}>Color Popularity</h3>
            <ColorPie data={meta!.colorStats} />
          </div>

          <div style={card}>
            <h3 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>Top Commanders</h3>
            <CommanderTable data={meta!.topCommanders} />
          </div>

          <div style={card}>
            <h3 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>Weekly Activity</h3>
            <Sparkline data={meta!.weeklyActivity} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Ranked() {
  const [tab, setTab] = useState<Tab>('Leaderboard')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <Trophy size={24} style={{ color: 'var(--brand-bright)' }} />
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
            Ranked
          </h1>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>ELO ladder &amp; metagame breakdown</p>
      </motion.div>

      <TabBar active={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'Leaderboard' ? <Leaderboard /> : <Metagame />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

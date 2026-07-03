/**
 * Sigil — Rankings data layer (§79, §83)
 *
 * Supabase queries for Leaderboard and Metagame views.
 * Guards for empty data — new platform = empty tables → friendly empty states.
 *
 * §83 addition: fetchLeaderboard() accepts an optional seasonId (or date window)
 * that scopes standings to match_history rows in the season window.
 * When seasonId is provided, win/loss are counted from match_history in the
 * window; when null the all-time profile.elo / wins / losses are used.
 */
import { supabase } from './supabase'
import type { ProfileRow } from './matchHistory'

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry extends ProfileRow {
  rank: number
  win_rate: number
}

/**
 * Fetch leaderboard standings.
 *
 * @param limit      Max rows returned
 * @param startsAt   ISO timestamp — if provided, scope to season window
 * @param endsAt     ISO timestamp — required when startsAt is provided
 */
export async function fetchLeaderboard(
  limit = 50,
  startsAt?: string,
  endsAt?: string
): Promise<LeaderboardEntry[]> {
  // ── All-time: rank by cumulative ELO on profiles table ────────────────────
  if (!startsAt || !endsAt) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, elo, wins, losses, created_at')
      .order('elo', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[rankings] fetchLeaderboard (all-time)', error.message)
      return []
    }

    return ((data ?? []) as ProfileRow[]).map((p, i) => {
      const total = (p.wins ?? 0) + (p.losses ?? 0)
      return {
        ...p,
        rank: i + 1,
        win_rate: total > 0 ? Math.round(((p.wins ?? 0) / total) * 100) : 0,
      }
    })
  }

  // ── Season-scoped: aggregate match_history in the window ──────────────────
  // We fetch match_history rows in the season window, group by user_id,
  // join profile display info, then sort by win count (descending).
  const { data: rows, error } = await supabase
    .from('match_history')
    .select('user_id, won')
    .gte('created_at', startsAt)
    .lte('created_at', endsAt)

  if (error) {
    console.warn('[rankings] fetchLeaderboard (season)', error.message)
    return []
  }

  if (!rows || rows.length === 0) return []

  // Aggregate wins/losses per user
  const byUser = new Map<string, { wins: number; losses: number }>()
  for (const r of rows as Array<{ user_id: string; won: boolean }>) {
    const prev = byUser.get(r.user_id) ?? { wins: 0, losses: 0 }
    byUser.set(r.user_id, {
      wins:   prev.wins   + (r.won ? 1 : 0),
      losses: prev.losses + (r.won ? 0 : 1),
    })
  }

  if (byUser.size === 0) return []

  // Fetch profile rows for the participating user IDs
  const userIds = Array.from(byUser.keys())
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, elo, wins, losses, created_at')
    .in('id', userIds)

  if (profErr) {
    console.warn('[rankings] fetchLeaderboard (season profiles)', profErr.message)
    return []
  }

  // Build leaderboard entries sorted by season wins
  const entries: LeaderboardEntry[] = ((profiles ?? []) as ProfileRow[])
    .map((p) => {
      const agg = byUser.get(p.id) ?? { wins: 0, losses: 0 }
      const total = agg.wins + agg.losses
      return {
        ...p,
        // Override all-time wins/losses with season window aggregates
        wins:   agg.wins,
        losses: agg.losses,
        rank:   0,  // filled below
        win_rate: total > 0 ? Math.round((agg.wins / total) * 100) : 0,
      }
    })
    .sort((a, b) => b.wins - a.wins || b.elo - a.elo)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  return entries
}

// ── Metagame ──────────────────────────────────────────────────────────────────

export interface WinRateByBracket {
  bracket: number
  games: number
  wins: number
  win_rate: number
}

export interface ColorStat {
  color: string   // 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
  label: string
  count: number
  pct: number
}

export interface CommanderStat {
  name: string
  games: number
  wins: number
  win_rate: number
}

export interface WeeklyActivity {
  week: string    // ISO date of week start
  games: number
}

export interface MetagameData {
  bracketWinRates: WinRateByBracket[]
  colorStats: ColorStat[]
  topCommanders: CommanderStat[]
  weeklyActivity: WeeklyActivity[]
  totalGames: number
}

const COLOR_LABELS: Record<string, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless',
}

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G', 'C']

export async function fetchMetagame(): Promise<MetagameData> {
  const { data, error } = await supabase
    .from('match_history')
    .select('won, bracket, commander_name, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    console.warn('[rankings] fetchMetagame', error.message)
    return empty()
  }

  const rows = (data ?? []) as Array<{
    won: boolean
    bracket: number | null
    commander_name: string | null
    created_at: string
  }>

  if (rows.length === 0) return empty()

  // ── Win-rate by bracket ────────────────────────────────────────────────────
  const byBracket = new Map<number, { games: number; wins: number }>()
  for (const r of rows) {
    if (r.bracket == null) continue
    const b = r.bracket
    const prev = byBracket.get(b) ?? { games: 0, wins: 0 }
    byBracket.set(b, { games: prev.games + 1, wins: prev.wins + (r.won ? 1 : 0) })
  }
  const bracketWinRates: WinRateByBracket[] = Array.from(byBracket.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bracket, { games, wins }]) => ({
      bracket,
      games,
      wins,
      win_rate: games > 0 ? Math.round((wins / games) * 100) : 0,
    }))

  // ── Commander stats ────────────────────────────────────────────────────────
  const byCmdr = new Map<string, { games: number; wins: number }>()
  for (const r of rows) {
    const name = r.commander_name?.trim()
    if (!name) continue
    const prev = byCmdr.get(name) ?? { games: 0, wins: 0 }
    byCmdr.set(name, { games: prev.games + 1, wins: prev.wins + (r.won ? 1 : 0) })
  }
  const topCommanders: CommanderStat[] = Array.from(byCmdr.entries())
    .map(([name, { games, wins }]) => ({
      name,
      games,
      wins,
      win_rate: games > 0 ? Math.round((wins / games) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10)

  // ── Color popularity (inferred from commander name heuristics) ─────────────
  const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
  const colorKeywords: Record<string, string[]> = {
    W: ['atraxa','rhys','heliod','avacyn','elspeth','odric','ayli','brago','darien'],
    U: ['arcanis','jin','teferi','talrand','edric','baral','niv','mizzix','riku','urza'],
    B: ['edgar','meren','gisa','mikaeus','yawgmoth','sheoldred','kokusho','glissa'],
    R: ['purphoros','krenko','zada','neheb','etali','maraxus','wulfgar'],
    G: ['azusa','selvala','omnath','ghave','titania','aesi','rhonas','vorinclex'],
  }
  for (const r of rows) {
    const name = (r.commander_name ?? '').toLowerCase()
    if (!name) { colorCounts['C']++; continue }
    let matched = false
    for (const [color, keys] of Object.entries(colorKeywords)) {
      if (keys.some((k) => name.includes(k))) { colorCounts[color]++; matched = true; break }
    }
    if (!matched) colorCounts['C']++
  }
  const colorTotal = Object.values(colorCounts).reduce((a, b) => a + b, 0)
  const colorStats: ColorStat[] = COLOR_ORDER.map((c) => ({
    color: c,
    label: COLOR_LABELS[c],
    count: colorCounts[c],
    pct: colorTotal > 0 ? Math.round((colorCounts[c] / colorTotal) * 100) : 0,
  }))

  // ── Weekly activity ────────────────────────────────────────────────────────
  const byWeek = new Map<string, number>()
  for (const r of rows) {
    const d = new Date(r.created_at)
    const day = d.getDay()
    const diff = (day === 0 ? -6 : 1) - day
    d.setDate(d.getDate() + diff)
    const key = d.toISOString().slice(0, 10)
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
  }
  const weeklyActivity: WeeklyActivity[] = Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, games]) => ({ week, games }))

  return {
    bracketWinRates,
    colorStats,
    topCommanders,
    weeklyActivity,
    totalGames: rows.length,
  }
}

function empty(): MetagameData {
  return {
    bracketWinRates: [],
    colorStats: COLOR_ORDER.map((c) => ({ color: c, label: COLOR_LABELS[c], count: 0, pct: 0 })),
    topCommanders: [],
    weeklyActivity: [],
    totalGames: 0,
  }
}

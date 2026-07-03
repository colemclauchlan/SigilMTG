/**
 * Sigil — Tournament data layer (§79)
 *
 * Tables: tournaments, tournament_players, tournament_rounds, tournament_pairings
 * Supports: Swiss and single-elimination bracket generation, ELO seeding, result reporting.
 *
 * NOTE: Returns typed results; renders gracefully against empty tables before
 * migration is applied (Supabase returns relation-does-not-exist error → empty state).
 */
import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TournamentFormat = 'swiss' | 'single_elim'
export type TournamentStatus = 'open' | 'active' | 'finished'

export interface Tournament {
  id: string
  name: string
  format: TournamentFormat
  bracket_cap: number
  status: TournamentStatus
  owner_id: string
  created_at: string
}

export interface TournamentPlayer {
  tournament_id: string
  profile_id: string
  seed: number | null
  dropped: boolean
  display_name?: string
  elo?: number
}

export interface TournamentRound {
  id: string
  tournament_id: string
  round_no: number
  created_at: string
}

export interface TournamentPairing {
  id: string
  round_id: string
  table_no: number
  player_ids: string[]
  winner_profile_id: string | null
  reported: boolean
}

export interface RoundWithPairings extends TournamentRound {
  pairings: TournamentPairing[]
}

export interface TournamentDetail extends Tournament {
  players: TournamentPlayer[]
  rounds: RoundWithPairings[]
}

export interface StandingsEntry {
  profile_id: string
  display_name: string
  elo: number
  match_points: number
  wins: number
  losses: number
  byes: number
}

// ── Safe query wrapper ────────────────────────────────────────────────────────
// Guards against "relation does not exist" (migration not yet applied)

async function safeQuery<T>(fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T | null> {
  try {
    const { data, error } = await fn()
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        console.info('[tournaments] migration not yet applied — returning empty state')
      } else {
        console.warn('[tournaments]', error.message)
      }
      return null
    }
    return data as T | null
  } catch (e) {
    console.warn('[tournaments] unexpected error', e)
    return null
  }
}

// ── List tournaments ──────────────────────────────────────────────────────────

export async function fetchTournaments(status?: TournamentStatus): Promise<Tournament[]> {
  const query = supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const result = status
    ? await safeQuery(() => query.eq('status', status))
    : await safeQuery(() => query)

  return (result as Tournament[] | null) ?? []
}

// ── Fetch single tournament with players + rounds ─────────────────────────────

export async function fetchTournamentDetail(id: string): Promise<TournamentDetail | null> {
  const tournament = await safeQuery<Tournament>(() =>
    supabase.from('tournaments').select('*').eq('id', id).single()
  )
  if (!tournament) return null

  const players = await safeQuery<TournamentPlayer[]>(() =>
    supabase
      .from('tournament_players')
      .select('tournament_id, profile_id, seed, dropped, profiles(display_name, elo)')
      .eq('tournament_id', id)
      .order('seed', { ascending: true })
  )

  // Flatten join
  const flatPlayers: TournamentPlayer[] = ((players ?? []) as unknown as Array<{
    tournament_id: string; profile_id: string; seed: number | null; dropped: boolean;
    profiles?: { display_name: string; elo: number }
  }>).map((p) => ({
    tournament_id: p.tournament_id,
    profile_id: p.profile_id,
    seed: p.seed,
    dropped: p.dropped,
    display_name: p.profiles?.display_name,
    elo: p.profiles?.elo,
  }))

  const rounds = await safeQuery<TournamentRound[]>(() =>
    supabase
      .from('tournament_rounds')
      .select('*')
      .eq('tournament_id', id)
      .order('round_no', { ascending: true })
  )

  const roundList = (rounds ?? []) as TournamentRound[]
  const roundsWithPairings: RoundWithPairings[] = []

  for (const round of roundList) {
    const pairings = await safeQuery<TournamentPairing[]>(() =>
      supabase
        .from('tournament_pairings')
        .select('*')
        .eq('round_id', round.id)
        .order('table_no', { ascending: true })
    )
    roundsWithPairings.push({ ...round, pairings: (pairings ?? []) as TournamentPairing[] })
  }

  return { ...tournament, players: flatPlayers, rounds: roundsWithPairings }
}

// ── Create tournament ─────────────────────────────────────────────────────────

export async function createTournament(
  ownerId: string,
  name: string,
  format: TournamentFormat = 'swiss',
  bracketCap = 8
): Promise<Tournament | null> {
  const result = await safeQuery<Tournament>(() =>
    supabase
      .from('tournaments')
      .insert({ name, format, bracket_cap: bracketCap, status: 'open', owner_id: ownerId })
      .select()
      .single()
  )
  return result
}

// ── Join tournament ───────────────────────────────────────────────────────────

export async function joinTournament(tournamentId: string, profileId: string): Promise<boolean> {
  const result = await safeQuery<unknown>(() =>
    supabase
      .from('tournament_players')
      .upsert({ tournament_id: tournamentId, profile_id: profileId, dropped: false }, { onConflict: 'tournament_id,profile_id' })
  )
  return result !== null
}

// ── Drop from tournament ──────────────────────────────────────────────────────

export async function dropFromTournament(tournamentId: string, profileId: string): Promise<boolean> {
  const result = await safeQuery<unknown>(() =>
    supabase
      .from('tournament_players')
      .update({ dropped: true })
      .eq('tournament_id', tournamentId)
      .eq('profile_id', profileId)
  )
  return result !== null
}

// ── Seed players by ELO ───────────────────────────────────────────────────────

export async function seedByElo(tournamentId: string): Promise<boolean> {
  // Fetch players with ELO from profiles join
  const players = await safeQuery<TournamentPlayer[]>(() =>
    supabase
      .from('tournament_players')
      .select('profile_id, profiles(elo)')
      .eq('tournament_id', tournamentId)
      .eq('dropped', false)
  ) as unknown as Array<{ profile_id: string; profiles?: { elo?: number } }> | null

  if (!players?.length) return false

  const sorted = [...players].sort(
    (a, b) => (b.profiles?.elo ?? 1200) - (a.profiles?.elo ?? 1200)
  )

  for (let i = 0; i < sorted.length; i++) {
    await safeQuery<unknown>(() =>
      supabase
        .from('tournament_players')
        .update({ seed: i + 1 })
        .eq('tournament_id', tournamentId)
        .eq('profile_id', sorted[i].profile_id)
    )
  }
  return true
}

// ── Generate next round ───────────────────────────────────────────────────────

export async function generateRound(tournamentId: string, format: TournamentFormat): Promise<TournamentRound | null> {
  // Get current round count
  const rounds = await safeQuery<TournamentRound[]>(() =>
    supabase
      .from('tournament_rounds')
      .select('round_no')
      .eq('tournament_id', tournamentId)
      .order('round_no', { ascending: false })
      .limit(1)
  )
  const nextRoundNo = ((rounds as TournamentRound[] | null)?.[0]?.round_no ?? 0) + 1

  // Create the round
  const round = await safeQuery<TournamentRound>(() =>
    supabase
      .from('tournament_rounds')
      .insert({ tournament_id: tournamentId, round_no: nextRoundNo })
      .select()
      .single()
  )
  if (!round) return null

  // Get active players sorted by seed
  const players = await safeQuery<TournamentPlayer[]>(() =>
    supabase
      .from('tournament_players')
      .select('profile_id, seed')
      .eq('tournament_id', tournamentId)
      .eq('dropped', false)
      .order('seed', { ascending: true })
  )
  const activePlayers = (players as TournamentPlayer[] | null) ?? []

  if (format === 'single_elim') {
    await generateSingleElimPairings(round.id, activePlayers)
  } else {
    await generateSwissPairings(round.id, tournamentId, activePlayers)
  }

  // Set tournament to active
  await safeQuery<unknown>(() =>
    supabase
      .from('tournaments')
      .update({ status: 'active' })
      .eq('id', tournamentId)
  )

  return round
}

async function generateSwissPairings(
  roundId: string,
  tournamentId: string,
  players: TournamentPlayer[]
): Promise<void> {
  // Simple Swiss: pair adjacent players by seed/points
  // In round 1 this is seed-based; subsequent rounds should use standings
  // For simplicity, we pair by current seed order
  const active = [...players]
  let byePlayerId: string | null = null

  if (active.length % 2 !== 0) {
    // Last player gets a bye
    byePlayerId = active[active.length - 1].profile_id
    active.pop()
  }

  const pairings: Array<Record<string, unknown>> = []
  for (let i = 0; i < active.length; i += 2) {
    pairings.push({
      round_id: roundId,
      table_no: Math.floor(i / 2) + 1,
      player_ids: [active[i].profile_id, active[i + 1].profile_id],
      winner_profile_id: null,
      reported: false,
    })
  }

  if (byePlayerId) {
    // Bye = auto-win, mark as reported
    pairings.push({
      round_id: roundId,
      table_no: active.length / 2 + 1,
      player_ids: [byePlayerId],
      winner_profile_id: byePlayerId,
      reported: true,
    })
  }

  if (pairings.length) {
    await safeQuery<unknown>(() =>
      supabase.from('tournament_pairings').insert(pairings)
    )
  }
}

async function generateSingleElimPairings(
  roundId: string,
  players: TournamentPlayer[]
): Promise<void> {
  // Single elim: 1 vs last, 2 vs second-to-last, etc.
  const active = [...players]
  const pairings: Array<Record<string, unknown>> = []
  let table = 1

  while (active.length >= 2) {
    const top = active.shift()!
    const bot = active.pop()!
    pairings.push({
      round_id: roundId,
      table_no: table++,
      player_ids: [top.profile_id, bot.profile_id],
      winner_profile_id: null,
      reported: false,
    })
  }

  // Bye for odd player
  if (active.length === 1) {
    pairings.push({
      round_id: roundId,
      table_no: table,
      player_ids: [active[0].profile_id],
      winner_profile_id: active[0].profile_id,
      reported: true,
    })
  }

  if (pairings.length) {
    await safeQuery<unknown>(() =>
      supabase.from('tournament_pairings').insert(pairings)
    )
  }
}

// ── Report result ─────────────────────────────────────────────────────────────

export async function reportResult(pairingId: string, winnerProfileId: string): Promise<boolean> {
  const result = await safeQuery<unknown>(() =>
    supabase
      .from('tournament_pairings')
      .update({ winner_profile_id: winnerProfileId, reported: true })
      .eq('id', pairingId)
  )
  return result !== null
}

// ── Standings ─────────────────────────────────────────────────────────────────
// Match points: 3 for win, 0 for loss, 1 for bye

export async function fetchStandings(tournamentId: string): Promise<StandingsEntry[]> {
  const detail = await fetchTournamentDetail(tournamentId)
  if (!detail) return []

  const points: Record<string, { wins: number; losses: number; byes: number; display_name: string; elo: number }> = {}

  for (const p of detail.players) {
    points[p.profile_id] = {
      wins: 0, losses: 0, byes: 0,
      display_name: p.display_name ?? p.profile_id.slice(0, 8),
      elo: p.elo ?? 1200,
    }
  }

  for (const round of detail.rounds) {
    for (const pairing of round.pairings) {
      if (!pairing.reported) continue
      if (pairing.player_ids.length === 1) {
        // Bye
        const pid = pairing.player_ids[0]
        if (points[pid]) points[pid].byes++
      } else {
        const winner = pairing.winner_profile_id
        for (const pid of pairing.player_ids) {
          if (!points[pid]) continue
          if (pid === winner) points[pid].wins++
          else points[pid].losses++
        }
      }
    }
  }

  return Object.entries(points)
    .map(([profile_id, s]) => ({
      profile_id,
      display_name: s.display_name,
      elo: s.elo,
      wins: s.wins,
      losses: s.losses,
      byes: s.byes,
      match_points: s.wins * 3 + s.byes,
    }))
    .sort((a, b) => b.match_points - a.match_points || b.elo - a.elo)
}

// ── Finish tournament ─────────────────────────────────────────────────────────

export async function finishTournament(tournamentId: string): Promise<boolean> {
  const result = await safeQuery<unknown>(() =>
    supabase
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', tournamentId)
  )
  return result !== null
}

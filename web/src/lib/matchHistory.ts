/**
 * Sigil — Match history + ELO data layer (§51, §53, §83)
 *
 * Wraps Supabase `match_history`, `profiles`, and `games` tables.
 * All reads return typed results; callers handle errors gracefully.
 *
 * §83 addition: after recording a game result, evaluateAchievements() is
 * called for each participant to award any newly-unlocked badges.
 */
import { supabase } from './supabase'
import { computeEloDeltas, DEFAULT_ELO } from './elo'
import {
  fetchCatalog,
  fetchUserAchievements,
  evaluateAchievements,
} from './achievements'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchRecord {
  id: string
  game_id: string
  user_id: string
  opponent_ids: string[]
  won: boolean
  elo_before: number
  elo_after: number
  elo_delta: number
  commander_name: string | null
  bracket: number | null
  duration_seconds: number | null
  created_at: string
}

export interface ProfileRow {
  id: string
  display_name: string
  avatar_url: string | null
  elo: number
  wins: number
  losses: number
  created_at: string
}

// ── Profile helpers ───────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) { console.warn('[matchHistory] fetchProfile', error.message); return null }
  return data as ProfileRow
}

export async function upsertProfile(
  userId: string,
  patch: Partial<Pick<ProfileRow, 'display_name' | 'avatar_url'>>
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch }, { onConflict: 'id' })
  if (error) console.warn('[matchHistory] upsertProfile', error.message)
}

// ── Match history ────────────────────────────────────────────────────────────

export async function fetchMatchHistory(
  userId: string,
  limit = 20
): Promise<MatchRecord[]> {
  const { data, error } = await supabase
    .from('match_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.warn('[matchHistory] fetchMatchHistory', error.message); return [] }
  return (data ?? []) as MatchRecord[]
}

// ── Record a completed game + update ELO ─────────────────────────────────────

export interface GameResult {
  gameId: string
  participants: Array<{
    userId: string
    displayName: string
    won: boolean
    commanderName?: string
    bracket?: number
    durationSeconds?: number
    /** Life total at end of the game (winner's life, for Untouchable badge) */
    finalLifeTotal?: number
    /** Commander damage dealt by this player this game (for Commander Carnage badge) */
    commanderDamageDealt?: number
  }>
}

export async function recordGameResult(result: GameResult): Promise<void> {
  const { participants, gameId } = result
  const userIds = participants.map((p) => p.userId)
  const winnerEntry = participants.find((p) => p.won)
  if (!winnerEntry) return

  // Fetch current ELOs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, elo, wins, losses')
    .in('id', userIds)

  const currentElos: Record<string, number> = {}
  const currentWins: Record<string, number> = {}
  const currentLosses: Record<string, number> = {}
  for (const p of profiles ?? []) {
    const row = p as { id: string; elo: number; wins: number; losses: number }
    currentElos[row.id] = row.elo ?? DEFAULT_ELO
    currentWins[row.id] = row.wins ?? 0
    currentLosses[row.id] = row.losses ?? 0
  }

  const newElos = computeEloDeltas(currentElos, winnerEntry.userId, userIds)

  // Insert match_history rows for each participant
  const rows = participants.map((p) => ({
    game_id: gameId,
    user_id: p.userId,
    opponent_ids: userIds.filter((id) => id !== p.userId),
    won: p.won,
    elo_before: currentElos[p.userId] ?? DEFAULT_ELO,
    elo_after: newElos[p.userId] ?? DEFAULT_ELO,
    elo_delta: (newElos[p.userId] ?? DEFAULT_ELO) - (currentElos[p.userId] ?? DEFAULT_ELO),
    commander_name: p.commanderName ?? null,
    bracket: p.bracket ?? null,
    duration_seconds: p.durationSeconds ?? null,
  }))

  const { error: insertErr } = await supabase.from('match_history').insert(rows)
  if (insertErr) console.warn('[matchHistory] insert', insertErr.message)

  // Update profile ELO + win/loss counters
  for (const p of participants) {
    const wonIncr = p.won ? 1 : 0
    const lossIncr = p.won ? 0 : 1
    const { error } = await supabase.rpc('increment_profile_stats', {
      p_user_id: p.userId,
      p_elo: newElos[p.userId] ?? DEFAULT_ELO,
      p_wins: wonIncr,
      p_losses: lossIncr,
    })
    if (error) {
      // Fallback: direct update (if RPC not yet deployed)
      await supabase
        .from('profiles')
        .upsert(
          {
            id: p.userId,
            elo: newElos[p.userId] ?? DEFAULT_ELO,
          },
          { onConflict: 'id' }
        )
    }
  }

  // ── §83: Evaluate achievements for each participant ────────────────────────
  // Fire-and-forget: we load catalog once, then check each user.
  // Errors are swallowed so a badge failure never blocks game recording.
  try {
    const catalog = await fetchCatalog()
    if (catalog.length === 0) return  // table not yet migrated — skip silently

    await Promise.all(
      participants.map(async (p) => {
        const earnedRows = await fetchUserAchievements(p.userId)
        const alreadyEarned = new Set(
          earnedRows
            .map((ua) => ua.achievement?.code)
            .filter((c): c is string => Boolean(c))
        )

        const newWins  = (currentWins[p.userId]   ?? 0) + (p.won ? 1 : 0)
        const newLosses = (currentLosses[p.userId] ?? 0) + (p.won ? 0 : 1)

        await evaluateAchievements(
          {
            userId:               p.userId,
            totalWins:            newWins,
            totalLosses:          newLosses,
            totalGames:           newWins + newLosses,
            wonThisGame:          p.won,
            finalLifeTotal:       p.finalLifeTotal,
            commanderDamageDealt: p.commanderDamageDealt,
          },
          catalog,
          alreadyEarned
        )
      })
    )
  } catch (err) {
    console.warn('[matchHistory] achievement evaluation error (non-fatal)', err)
  }
}

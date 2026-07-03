/**
 * Sigil — Achievements / badges data layer (§83)
 *
 * Tables:
 *   achievements      — catalog (id, code, name, description, icon, tier)
 *   user_achievements — earned rows (user_id, achievement_id, earned_at)
 *
 * RLS:
 *   achievements      — public-read
 *   user_achievements — public-read + owner INSERT (no duplicate due to UNIQUE constraint)
 *
 * Client-side evaluateAchievements():
 *   Called after recordGameResult() with aggregated career stats.
 *   Checks which achievements are newly met and inserts user_achievements rows.
 *   Idempotent: ON CONFLICT DO NOTHING on the unique (user_id, achievement_id) index.
 */
import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface Achievement {
  id: string
  code: string
  name: string
  description: string
  icon: string          // emoji or short string rendered in the badge
  tier: AchievementTier
}

export interface UserAchievement {
  user_id: string
  achievement_id: string
  earned_at: string
  achievement?: Achievement
}

// ── Stats shape passed from recordGameResult context ─────────────────────────

export interface CareerStats {
  userId: string
  totalWins: number
  totalLosses: number
  totalGames: number
  /** Did the local player WIN this specific game? */
  wonThisGame: boolean
  /** Life total at end of this game (if winner) */
  finalLifeTotal?: number
  /** Commander damage dealt by this player this game */
  commanderDamageDealt?: number
}

// ── Catalog fetch ─────────────────────────────────────────────────────────────

export async function fetchCatalog(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('tier', { ascending: true })

  if (error) {
    console.warn('[achievements] fetchCatalog', error.message)
    return []
  }
  return (data ?? []) as Achievement[]
}

// ── User achievements fetch ───────────────────────────────────────────────────

export async function fetchUserAchievements(userId: string): Promise<UserAchievement[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('*, achievement:achievements(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  if (error) {
    console.warn('[achievements] fetchUserAchievements', error.message)
    return []
  }
  return (data ?? []) as UserAchievement[]
}

// ── Client-side evaluation logic ──────────────────────────────────────────────

/**
 * Achievement codes → predicate functions.
 * Each returns true if the stats meet the criterion.
 */
const PREDICATES: Record<string, (s: CareerStats) => boolean> = {
  first_blood:        (s) => s.wonThisGame && s.totalWins >= 1,
  five_wins:          (s) => s.totalWins >= 5,
  pod_slayer:         (s) => s.totalWins >= 10,
  veteran:            (s) => s.totalWins >= 25,
  legend:             (s) => s.totalWins >= 50,
  first_game:         (s) => s.totalGames >= 1,
  road_warrior:       (s) => s.totalGames >= 20,
  marathon:           (s) => s.totalGames >= 100,
  commander_carnage:  (s) => (s.commanderDamageDealt ?? 0) >= 21,
  untouchable:        (s) => s.wonThisGame && (s.finalLifeTotal ?? 0) >= 40,
  bracket_climber:    (s) => s.totalWins >= 3,
  come_back_kid:      (s) => s.wonThisGame && (s.finalLifeTotal ?? 40) <= 5,
}

/**
 * After a game result is recorded, call this to award any newly-earned achievements.
 * Already-earned achievements are skipped (unique constraint on DB side).
 *
 * @param stats     Career stats snapshot AFTER this game is counted
 * @param catalog   Full achievement catalog (from fetchCatalog)
 * @param alreadyEarned Set of achievement codes the user has already earned
 */
export async function evaluateAchievements(
  stats: CareerStats,
  catalog: Achievement[],
  alreadyEarned: Set<string>
): Promise<Achievement[]> {
  const newlyEarned: Achievement[] = []

  for (const ach of catalog) {
    if (alreadyEarned.has(ach.code)) continue
    const pred = PREDICATES[ach.code]
    if (!pred) continue
    if (!pred(stats)) continue

    // Award it
    const { error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: stats.userId,
        achievement_id: ach.id,
      })

    if (error && !error.message.includes('duplicate')) {
      console.warn('[achievements] award', ach.code, error.message)
    } else {
      newlyEarned.push(ach)
    }
  }

  return newlyEarned
}

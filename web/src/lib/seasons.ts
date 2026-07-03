/**
 * Sigil — Seasons data layer (§83)
 *
 * A "season" is a named time window that scopes leaderboard standings
 * to match_history rows within [starts_at, ends_at].
 * ELO itself is cumulative — seasons compute standings from match_history,
 * no destructive ELO reset.
 *
 * Table: seasons (id, name, starts_at, ends_at, is_active)
 * RLS:   public-read only (managed by admins / migration seed)
 */
import { supabase } from './supabase'

export interface Season {
  id: string
  name: string
  starts_at: string   // ISO timestamp
  ends_at: string     // ISO timestamp
  is_active: boolean
}

// ── Fetch the currently active season (null when off-season) ──────────────────
export async function fetchActiveSeason(): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[seasons] fetchActiveSeason', error.message)
    return null
  }
  return data as Season | null
}

// ── Fetch all seasons (for the selector dropdown) ─────────────────────────────
export async function fetchSeasons(): Promise<Season[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .order('starts_at', { ascending: false })

  if (error) {
    console.warn('[seasons] fetchSeasons', error.message)
    return []
  }
  return (data ?? []) as Season[]
}

// ── Human-readable countdown: "ends in Xd" / "Xh" / "ended" ─────────────────
export function seasonCountdown(season: Season): string {
  const now = Date.now()
  const end = new Date(season.ends_at).getTime()
  const diff = end - now
  if (diff <= 0) return 'Season ended'
  const days = Math.floor(diff / 86_400_000)
  if (days >= 1) return `Season ends in ${days}d`
  const hours = Math.floor(diff / 3_600_000)
  return `Season ends in ${hours}h`
}

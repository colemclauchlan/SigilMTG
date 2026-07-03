/**
 * web/src/lib/replays.ts — Replay/VOD persistence layer (#82)
 *
 * Saves and fetches game replays from the `match_replays` Supabase table.
 * The server broadcasts `replayReady` after game-over; net.ts calls saveReplay().
 * Replay.tsx calls fetchReplay() to load a single VOD.
 * ReplayList.tsx calls fetchReplays() for the user's recent games.
 *
 * Table schema (apply via master):
 *   match_replays (id uuid PK, game_id text, players jsonb, intent_log jsonb,
 *                  winner_seat int, created_at timestamptz, user_id uuid FK auth.users)
 *   RLS: public read; INSERT only own rows (auth.uid() = user_id).
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReplayIntent {
  seq: number
  t: number       // epoch ms
  seat: number
  intent: unknown
}

export interface ReplayPlayer {
  seat: number
  userId: string
  displayName: string
}

export interface ReplaySavePayload {
  game_id: string
  players: ReplayPlayer[]
  intent_log: ReplayIntent[]
  winner_seat: number
}

export interface ReplayRow {
  id: string
  game_id: string
  players: ReplayPlayer[]
  intent_log: ReplayIntent[]
  winner_seat: number
  created_at: string
  user_id: string | null
}

// ── Save replay (called by net.ts on replayReady) ─────────────────────────────

export async function saveReplay(payload: ReplaySavePayload): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id ?? null

  const row = {
    game_id:     payload.game_id,
    players:     payload.players,
    intent_log:  payload.intent_log,
    winner_seat: payload.winner_seat,
    user_id:     userId,
  }

  const { data, error } = await supabase
    .from('match_replays')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.warn('[replays] saveReplay error:', error.message)
    return null
  }
  return (data as { id: string }).id
}

// ── Fetch single replay (by UUID) ─────────────────────────────────────────────

export async function fetchReplay(id: string): Promise<ReplayRow | null> {
  const { data, error } = await supabase
    .from('match_replays')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.warn('[replays] fetchReplay error:', error.message)
    return null
  }
  return data as ReplayRow
}

// ── Fetch recent replays for a user (or current user if omitted) ──────────────

export async function fetchReplays(userId?: string, limit = 20): Promise<ReplayRow[]> {
  let uid = userId
  if (!uid) {
    const { data: { session } } = await supabase.auth.getSession()
    uid = session?.user?.id
  }
  if (!uid) return []

  const { data, error } = await supabase
    .from('match_replays')
    .select('id, game_id, players, winner_seat, created_at, user_id')
    .contains('players', JSON.stringify([{ userId: uid }]))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[replays] fetchReplays error:', error.message)
    return []
  }
  return (data ?? []) as ReplayRow[]
}

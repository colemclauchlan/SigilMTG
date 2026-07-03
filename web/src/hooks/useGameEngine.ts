/**
 * useGameEngine — dispatch hook for board actions.
 *
 * Branches on whether we are in online (server-authoritative) or solo (local) mode.
 * The mode is determined by whether `onlineSendIntent` is set in the Zustand store.
 * Tabletop.tsx registers it via store.setOnlineSendIntent() when useRoom() connects.
 * All existing callers (CardMenu, HandMenu, Board, modals, etc.) call useGameEngine()
 * with NO arguments — they automatically pick up the correct mode from the store.
 *
 *   Online mode (store.onlineSendIntent is set):
 *     Actions are translated to typed Intents and sent to the Colyseus server.
 *     The local MTGCore reducer is NOT called — server snapshots update the store.
 *
 *   Solo mode (store.onlineSendIntent is null):
 *     Actions run through window.MTGCore.reduce() locally, exactly as before.
 */
import { useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Zone } from '../types/game'
import type { Intent } from '../lib/net'

// MTGCore is the vanilla table-core.js UMD module (window global from index.html).
declare global {
  interface Window {
    MTGCore: {
      init: (opts: Record<string, unknown>) => Record<string, unknown>
      reduce: (state: Record<string, unknown>, action: Record<string, unknown>) => Record<string, unknown>
      invert: (action: Record<string, unknown>, before: Record<string, unknown>) => Record<string, unknown>
      cardsOf: (state: Record<string, unknown>, seat: number, zone: string) => Record<string, unknown>[]
      zoneCount: (state: Record<string, unknown>, seat: number, zone: string) => number
      shuffle: (arr: unknown[], seed: string) => unknown[]
      nextPos: (state: Record<string, unknown>, seat: number, zone: string) => number
    }
  }
}

// ── Action → Intent translation (local reducer shape → server intent shape) ──

/**
 * Translate a MTGCore reducer action (t: string, ...) into a server Intent.
 * Returns null for action types that have no direct server equivalent.
 */
const PHASE_LABELS: Record<string, string> = { untap: 'Untap', upkeep: 'Upkeep', draw: 'Draw', main1: 'Main 1', combat: 'Combat', main2: 'Main 2', end: 'End' }
function toIntent(action: Record<string, unknown>): Intent | null {
  switch (action.t) {
    // Life
    case 'adjust_life':
      return { type: 'setLife', delta: action.delta as number, seat: action.seat as number | undefined }
    case 'set_life': {
      // Server setLife uses delta — compute from current store player life
      const players = useGameStore.getState().gameState?.players
      const currentLife = players?.[action.seat as number]?.life ?? 40
      return { type: 'setLife', delta: (action.value as number) - currentLife }
    }

    // Card movement
    case 'card_move':
      return {
        type: 'cardMove',
        instanceId: action.instanceId as string,
        toZone: action.toZone as string,
        x: action.x as number | undefined,
        y: action.y as number | undefined,
      }

    // Tap / untap
    case 'card_tap':
      return {
        type: 'cardTap',
        instanceId: action.instanceId as string,
        tapped: action.tapped as boolean | undefined,
      }
    case 'untap_all':
      return { type: 'untapAll' }

    // Draw
    case 'draw':
      return { type: 'draw', count: (action.count as number | undefined) ?? 1 }

    // Counters on cards
    case 'card_counter':
      return {
        type: 'cardCounter',
        instanceId: action.instanceId as string,
        kind: action.kind as string,
        delta: action.delta as number,
      }

    // Pass turn
    case 'pass_turn':
      return { type: 'passTurn' }

    // Stack
    case 'stack_push':
      return {
        type: 'stackPush',
        id: action.id as string,
        kind: action.kind as 'spell' | 'ability' | 'triggered',
        source: action.source as string,
        sourceName: (action.sourceName as string | undefined) ?? String(action.source ?? ''),
        effects: action.effects as unknown[] | undefined,
        targets: action.targets as unknown[] | undefined,
      }
    case 'stack_resolve':
      return { type: 'stackResolve' }
    case 'stack_remove':
      return { type: 'stackRemove', id: action.id as string }
    case 'stack_reorder':
      return { type: 'stackReorder', orderedIds: action.orderedIds as string[] }

    // Board wipe
    case 'board_wipe':
      return { type: 'boardWipe' }

    // Combat
    case 'declare_attackers':
      return {
        type: 'declareAttackers',
        attackPlan: action.attackPlan as Array<{ attacker: string; blocker: string | null; targetSeat: number }>,
      }
    case 'declare_blockers':
      return {
        type: 'declareBlockers',
        attackPlan: action.attackPlan as Array<{ attacker: string; blocker: string | null; targetSeat: number }>,
      }
    case 'resolve_combat':
      return { type: 'resolveCombat' }

    // Targeting (creates server annotation)
    case 'target':
      return {
        type: 'target',
        sourceId: action.sourceId as string,
        targetId: action.targetId as string,
        targetKind: (action.targetKind as 'card' | 'player') ?? 'card',
        targetSeat: action.targetSeat as number | undefined,
      }

    // Pass priority
    case 'pass_priority':
      return { type: 'passPriority' }

    case 'set_phase':
      return { type: 'setPhase', phase: action.phase as string }
    case 'player_counter':
      return { type: 'playerCounter', seat: action.seat as number, kind: action.kind as string, delta: action.delta as number }
    case 'commander_damage':
      return { type: 'commanderDamage', seat: action.seat as number, fromSeat: action.fromSeat as number, fromCmd: (action.fromCmd as string) ?? 'primary', delta: action.delta as number }
    case 'token_create':
      return { type: 'createToken', instanceId: action.instanceId as string, cardId: (action.cardId as string | null) ?? null, name: action.name as string, ownerSeat: action.ownerSeat as number, x: action.x as number, y: action.y as number }
    case 'card_flip':
      return { type: 'cardFlip', instanceId: action.instanceId as string, faceDown: action.faceDown as boolean | undefined }
    case 'card_transform':
      return { type: 'cardTransform', instanceId: action.instanceId as string }
    case 'card_clone':
      return { type: 'cardClone', fromId: action.fromId as string, instanceId: action.instanceId as string, x: action.x as number, y: action.y as number }
    case 'library_shuffle':
      return { type: 'shuffle', seat: action.seat as number }
    case 'mill':
      return { type: 'mill', seat: action.seat as number, count: (action.count as number) ?? 1 }

    // Actions with no server equivalent — handled by server snapshots
    // or are pure-client UI state (annotation_*, card_combat flag, __remove, card_tap_many, etc.)
    default:
      return null
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGameEngine() {
  // Read the online send function from the store.
  // It is null in solo mode and set by Tabletop when useRoom() connects.
  const onlineSendIntent = useGameStore((s) => s.onlineSendIntent)
  const isOnline = onlineSendIntent !== null

  // ── Main dispatch ──────────────────────────────────────────────────────────

  const dispatch = useCallback((action: Record<string, unknown>) => {
    // Get the current sendIntent at call time (not closure time) to avoid
    // stale captures. We re-read from the store directly.
    const sendFn = useGameStore.getState().onlineSendIntent

    // Annotations are pure-client board overlays — apply them locally in BOTH modes.
    const CLIENT_ONLY = action.t === 'annotation_create' || action.t === 'annotation_update' || action.t === 'annotation_delete'
    if (sendFn && !CLIENT_ONLY) {
      // Online mode: translate action to intent and send to server
      const intent = toIntent(action)
      if (intent) {
        sendFn(intent)
      }
      // null-mapped actions are no-ops online (server owns that state change)
      return
    }

    // Solo mode: run through local MTGCore reducer
    const gs = useGameStore.getState().gameState
    if (!gs || !window.MTGCore) return

    // Push undo before mutating
    const inv = window.MTGCore.invert(action, gs as unknown as Record<string, unknown>)
    useGameStore.getState().pushUndoEntry(inv as { t: string; [k: string]: unknown })

    const next = window.MTGCore.reduce(gs as unknown as Record<string, unknown>, action)
    useGameStore.getState().setGameState(next as unknown as typeof gs)

    // Log
    const desc = describeAction(action, gs as unknown as Record<string, unknown>)
    if (desc) useGameStore.getState().pushLogEntry(desc)

    // Disable mulligan once a card is played onto the battlefield
    if (action.t === 'card_move' && action.toZone === 'battlefield') {
      useGameStore.getState().disableMulligan()
    }
  }, [])  // no deps — always reads store at call time

  // ── Undo ───────────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const sendFn = useGameStore.getState().onlineSendIntent
    if (sendFn) {
      sendFn({ type: 'undoLast' })
      return
    }
    // Solo: pop local undo stack
    const inv = useGameStore.getState().popUndo()
    if (!inv) return
    const gs = useGameStore.getState().gameState
    if (!gs || !window.MTGCore) return
    const next = window.MTGCore.reduce(gs as unknown as Record<string, unknown>, inv as Record<string, unknown>)
    useGameStore.getState().setGameState(next as unknown as typeof gs)
    useGameStore.getState().pushLogEntry('<b>Undo</b>')
  }, [])

  // ── Read helpers (always read from store — server writes same store in online mode) ──

  const cardsOf = useCallback((seat: number, zone: Zone) => {
    const gs = useGameStore.getState().gameState
    if (!gs || !window.MTGCore) return []
    return window.MTGCore.cardsOf(gs as unknown as Record<string, unknown>, seat, zone)
  }, [])

  const zoneCount = useCallback((seat: number, zone: Zone) => {
    const gs = useGameStore.getState().gameState
    if (!gs || !window.MTGCore) return 0
    return window.MTGCore.zoneCount(gs as unknown as Record<string, unknown>, seat, zone)
  }, [])

  return { dispatch, undo, cardsOf, zoneCount, isOnline }
}

// ── Action description (for the solo-mode log) ────────────────────────────────

function describeAction(
  a: Record<string, unknown>,
  state: Record<string, unknown>
): string {
  const cards = (state.cards || {}) as Record<string, Record<string, unknown>>
  const players = (state.players || []) as { name?: string }[]
  const name = (id: unknown) => {
    const c = cards[id as string]
    return c ? `<b>${esc(String(c.name || id))}</b>` : `<b>${esc(String(id))}</b>`
  }
  const pname = (seat: unknown) => {
    const i = typeof seat === 'number' ? seat : ((state.activeSeat as number) ?? 0)
    return `<b>${esc(String(players[i]?.name || ('Seat ' + (i + 1))))}</b>`
  }
  switch (a.t) {
    case 'set_phase': return `${pname(state.activeSeat)} moved to ${PHASE_LABELS[a.phase as string] ?? a.phase}`
    case 'draw': return `${pname(a.seat)} drew ${a.count ?? 1} card${(a.count as number) > 1 ? 's' : ''}`
    case 'mill': return `Milled ${a.count ?? 1}`
    case 'card_move':
      return `${name(a.instanceId)} → ${a.toZone}`
    case 'card_tap':
      return `${name(a.instanceId)} tapped/untapped`
    case 'card_tap_many':
      return `${(a.tapped ? 'Tapped' : 'Untapped')} ${(a.instanceIds as string[])?.length ?? 0} cards`
    case 'untap_all': return 'Untapped all'
    case 'card_counter': {
      const delta = (a.delta as number) ?? 0
      return `${name(a.instanceId)} ${delta > 0 ? '+' : ''}${delta} ${a.kind} counter`
    }
    case 'player_counter':
      return `${pname(a.seat)} ${(a.delta as number) > 0 ? '+' : ''}${a.delta} ${a.kind}`
    case 'set_life':
      return `${pname(a.seat)} life → ${a.value}`
    case 'adjust_life':
      return `${pname(a.seat)} life ${(a.delta as number) > 0 ? '+' : ''}${a.delta}`
    case 'pass_turn':
      return `${pname(a.toSeat)} took the turn`
    case 'library_shuffle': return 'Shuffled library'
    case 'token_create': return `Created token <b>${esc(String(a.name || 'Token'))}</b>`
    case 'card_flip': return `${name(a.instanceId)} flipped`
    case 'card_transform': return `${name(a.instanceId)} transformed`
    case 'annotation_create': return `Created ${a.kind}`
    default: return ''
  }
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c
  )
}

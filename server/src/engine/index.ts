/**
 * server/src/engine/index.ts
 *
 * TypeScript adapter layer for the Sigil engine modules (ported from root JS).
 * The JS files use UMD wrappers that work in Node via `require()` — we import
 * them with createRequire to avoid ESM/CJS friction, then re-export everything
 * through typed facades so GameRoom.ts and tests can use them cleanly.
 *
 * Nothing here is a rewrite. The originals are COPIED verbatim from the root
 * so the source of truth stays in the root; we only wrap them here.
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const req        = createRequire(import.meta.url)

// ── Load engine modules (relative to this file) ─────────────────────────────
const MTGCore        = req(path.join(__dirname, 'table-core.js'))
const EngineCore     = req(path.join(__dirname, 'engine-core.js'))
const RulesTurn      = req(path.join(__dirname, 'rules-turn.js'))
const RulesSBA       = req(path.join(__dirname, 'rules-sba.js'))
const RulesCombat    = req(path.join(__dirname, 'rules-combat.js'))
const CombatTurn     = req(path.join(__dirname, 'rules-combat-turn.js'))
const CombatDeclare  = req(path.join(__dirname, 'rules-combat-declare.js'))
const RulesTriggers  = req(path.join(__dirname, 'rules-triggers.js'))
const RulesStatic    = req(path.join(__dirname, 'rules-static.js'))
const RulesKeywords  = req(path.join(__dirname, 'rules-keywords.js'))

// ── Shared context object passed to modules that use ctx pattern ─────────────
export const engineCtx = {
  Core:    MTGCore,
  SBA:     RulesSBA,
  Combat:  RulesCombat,
  CombatTurn,
  CombatDeclare,
  Turn:    RulesTurn,
  Triggers: RulesTriggers,
  Static:  RulesStatic,
  Keywords: RulesKeywords,
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface CardState {
  instanceId: string
  cardId: string | null
  name: string
  ownerSeat: number
  controllerSeat: number
  zone: string
  pos: number
  x: number | null
  y: number | null
  z: number
  tapped: boolean
  faceDown: boolean
  flipped: number
  phased: boolean
  attacking: boolean
  counters: Record<string, number>
  attachedTo: string | null
  attachOrder: number | null
  isToken: boolean
  isCommander: boolean
  setCode: string | null
  collectorNumber: string | null
  isFoil: boolean
  isEtched: boolean
  revealedTo: number[]
}

export interface PlayerGameState {
  seat: number
  life: number
  counters: Record<string, number>
  cmdDamage: Record<string, number>
}

export interface GameState {
  seats: number
  activeSeat: number
  turn: number
  phase: string
  players: PlayerGameState[]
  cards: Record<string, CardState>
  annotations: Record<string, unknown>
}

export interface StackItem {
  id: string
  controllerSeat: number
  kind: string
  source: string | null
  uncounterable: boolean
  effects: unknown[]
  targets: unknown[]
}

export interface EngineState {
  game: GameState
  stack: StackItem[]
  priority: number
  passes: number
  step: string
  seed: string
  log: unknown[]
}

export interface DeckCard {
  instanceId?: string
  cardId?: string | null
  name?: string
  zone?: string
  isCommander?: boolean
}

export interface InitOptions {
  seats?: number
  deckSize?: number
  startingLife?: number
  decks?: DeckCard[][]
  seed?: string
}

// ── Authoritative SBA enforcement ───────────────────────────────────────────
// Wire SBA detectors into EngineCore so advance() auto-enforces them.

RulesSBA.DETECTORS.forEach((detector: (game: GameState) => Array<{kind: string; instanceId?: string; seat?: number; rule: string}>) => {
  EngineCore.registerSBA((game: GameState) => {
    const findings = detector(game)
    // Map findings to table-core primitive events
    return findings.map((f: {kind: string; instanceId?: string; seat?: number}) => {
      if (f.kind === 'cease_to_exist' && f.instanceId) {
        return { t: '__remove', ids: [f.instanceId] }
      }
      if (f.kind === 'attachment' && f.instanceId) {
        return { t: '__set', cards: [{ id: f.instanceId, fields: { attachedTo: null } }] }
      }
      // player_loss and legend_rule are flagged only (no auto-action for now)
      return null
    }).filter(Boolean)
  })
})

// ── Engine factory ───────────────────────────────────────────────────────────

/**
 * Create a fresh authoritative engine state for a new game.
 */
export function createEngineState(opts: InitOptions = {}): EngineState {
  return EngineCore.create(opts) as EngineState
}

/**
 * Dispatch a table-core primitive or engine event; returns new state.
 */
export function dispatch(estate: EngineState, event: unknown): EngineState {
  return EngineCore.dispatch(estate, event) as EngineState
}

/**
 * Run the CR priority routine: continuous -> SBAs (stable) -> triggers -> grant priority.
 */
export function advance(estate: EngineState): EngineState {
  return EngineCore.advance(estate) as EngineState
}

/**
 * A player passes priority. When all pass: resolve top of stack, or advance the step.
 */
export function passPriority(estate: EngineState): EngineState {
  return EngineCore.passPriority(estate) as EngineState
}

/**
 * Peek at the top of the stack without mutating.
 */
export function stackTop(estate: EngineState): StackItem | null {
  return EngineCore.top(estate) as StackItem | null
}

// ── Turn structure ───────────────────────────────────────────────────────────

export const STEPS: Array<{name: string; phase: string; untap?: boolean; draw?: boolean; priority: boolean}> =
  RulesTurn.STEPS

/**
 * Perform a named step (CR 500 sequence) on the engine state.
 */
export function performStep(estate: EngineState, stepName: string, opts: Record<string, unknown> = {}): EngineState {
  const step = STEPS.find(s => s.name === stepName)
  if (!step) throw new Error(`Unknown step: ${stepName}`)
  return RulesTurn.performStep(EngineCore, estate, step, opts) as EngineState
}

/**
 * Run the full untap -> cleanup sequence for the active seat (auto mode).
 */
export function playTurn(estate: EngineState, opts: Record<string, unknown> = {}): EngineState {
  return RulesTurn.playTurn(EngineCore, estate, opts) as EngineState
}

// ── SBA ─────────────────────────────────────────────────────────────────────

export interface SBAFinding {
  rule: string
  kind: string
  severity: string
  seat?: number
  instanceId?: string
  instanceIds?: string[]
  message: string
}

/**
 * Detect all SBA violations; returns advisory findings (doesn't mutate).
 */
export function detectSBAs(game: GameState): SBAFinding[] {
  return RulesSBA.detectAll(game) as SBAFinding[]
}

// ── Combat ───────────────────────────────────────────────────────────────────

export interface AttackPair {
  attacker: string
  blockers: string[]
}

/**
 * Declare all legal attackers for a seat.
 */
export function declareAttackers(estate: EngineState, seat: number): AttackPair[] {
  return CombatDeclare.declareAttackers(estate.game, seat, engineCtx) as AttackPair[]
}

/**
 * Apply an attack plan (attackers + blockers) to the engine state.
 * Taps attackers, applies combat damage, moves lethal creatures to graveyard.
 */
export function runCombat(estate: EngineState, defenderSeat: number, attackPlan: AttackPair[]): EngineState {
  return CombatTurn.runCombat(EngineCore, estate, defenderSeat, attackPlan, engineCtx) as EngineState
}

// ── Commander tax ────────────────────────────────────────────────────────────

/**
 * Increment the commander-tax counter for a card when it moves to command zone.
 * Call this whenever a commander goes back to the command zone after dying/exiling.
 */
export function applyCommanderTax(estate: EngineState, instanceId: string): EngineState {
  const card = estate.game.cards[instanceId]
  if (!card || !card.isCommander) return estate
  return dispatch(estate, {
    t: 'card_counter',
    instanceId,
    kind: 'commanderTax',
    delta: 1
  })
}

/**
 * Get commander tax cost modifier for a commander card (2 per tax counter).
 */
export function commanderTaxCost(estate: EngineState, instanceId: string): number {
  const card = estate.game.cards[instanceId]
  if (!card) return 0
  return ((card.counters['commanderTax'] ?? 0)) * 2
}

// ── Hidden-info filter ───────────────────────────────────────────────────────

/**
 * Filter game state for what seat `viewingSeat` is allowed to see.
 * - Own hand/library: full card data
 * - Opponent hand: count only (no card data)
 * - Opponent library: count only
 * - Face-down cards: masked unless revealed to this seat
 * - Stack: fully visible (per CR)
 */
export function filterForSeat(estate: EngineState, viewingSeat: number): EngineState {
  const clone = (o: unknown) => JSON.parse(JSON.stringify(o))
  const filtered = clone(estate) as EngineState

  for (const id in filtered.game.cards) {
    const card = filtered.game.cards[id]

    // Face-down cards: only owner and revealedTo seats see identity
    if (card.faceDown && card.ownerSeat !== viewingSeat && !card.revealedTo.includes(viewingSeat)) {
      card.name = ''
      card.cardId = null
      card.setCode = null
      card.collectorNumber = null
    }

    // Opponent hidden zones (hand, library): replace with a sentinel
    if (card.ownerSeat !== viewingSeat && (card.zone === 'hand' || card.zone === 'library')) {
      if (!card.revealedTo.includes(viewingSeat)) {
        card.name = ''
        card.cardId = null
        card.setCode = null
        card.collectorNumber = null
      }
    }
  }

  return filtered
}

/**
 * Build a per-seat snapshot: the full engine state filtered for what `viewingSeat` may see,
 * plus convenience counts for opponent zones.
 */
export interface SeatSnapshot {
  estate: EngineState
  viewingSeat: number
  opponentZoneCounts: Record<number, { hand: number; library: number }>
}

export function buildSeatSnapshot(estate: EngineState, viewingSeat: number): SeatSnapshot {
  const filtered = filterForSeat(estate, viewingSeat)

  // Count opponent hidden zone sizes (so UI can show "opponent has 7 cards in hand")
  const opponentZoneCounts: Record<number, { hand: number; library: number }> = {}
  for (let seat = 0; seat < estate.game.seats; seat++) {
    if (seat === viewingSeat) continue
    let hand = 0, library = 0
    for (const id in estate.game.cards) {
      const card = estate.game.cards[id]
      if (card.ownerSeat !== seat) continue
      if (card.zone === 'hand') hand++
      if (card.zone === 'library') library++
    }
    opponentZoneCounts[seat] = { hand, library }
  }

  return { estate: filtered, viewingSeat, opponentZoneCounts }
}

/**
 * Build a spectator snapshot: all seat public zones visible, but NO hidden-info
 * for ANY seat — hand/library card identities are stripped for every seat,
 * and face-down cards are masked for everyone.  Spectators see:
 *   • battlefield, graveyard, exile, command zone: full card data
 *   • hand + library: count only (card identities stripped)
 *   • face-down cards: masked (name = '', cardId = null)
 * This is the correct paper-MTG information state for a table bystander.
 */
export function buildSpectatorSnapshot(estate: EngineState): SeatSnapshot {
  const clone = (o: unknown) => JSON.parse(JSON.stringify(o)) as typeof o
  const filtered = clone(estate) as EngineState

  // Strip hidden info for ALL seats (spectators see no one's hand/library identity)
  for (const id in filtered.game.cards) {
    const card = filtered.game.cards[id]

    // Hidden zones: strip identity for all seats
    if (card.zone === 'hand' || card.zone === 'library') {
      card.name = ''
      card.cardId = null
      card.setCode = null
      card.collectorNumber = null
    }

    // Face-down cards: always masked for spectators
    if (card.faceDown) {
      card.name = ''
      card.cardId = null
      card.setCode = null
      card.collectorNumber = null
    }
  }

  // Provide zone counts for all seats (UI shows "Player 1 has 6 cards in hand")
  const opponentZoneCounts: Record<number, { hand: number; library: number }> = {}
  for (let seat = 0; seat < estate.game.seats; seat++) {
    let hand = 0, library = 0
    for (const id in estate.game.cards) {
      const card = estate.game.cards[id]
      if (card.ownerSeat !== seat) continue
      if (card.zone === 'hand') hand++
      if (card.zone === 'library') library++
    }
    opponentZoneCounts[seat] = { hand, library }
  }

  // viewingSeat = -1 signals "spectator" to clients
  return { estate: filtered, viewingSeat: -1, opponentZoneCounts }
}

// ── Re-exports (raw modules for tests) ──────────────────────────────────────

export { MTGCore, EngineCore, RulesTurn, RulesSBA, RulesCombat, CombatTurn, CombatDeclare, RulesTriggers, RulesStatic, RulesKeywords }

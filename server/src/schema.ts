/**
 * Sigil — Authoritative game-room schema (Colyseus @colyseus/schema).
 * Phase 3: full state including engine snapshot, LIFO stack, and combat.
 *
 * NOTE: The authoritative engine state lives as a raw JS object (EngineState)
 * on the GameRoom instance — NOT in the Colyseus schema (the engine objects
 * are too large/nested for schema serialization and don't need it). The schema
 * holds only the client-visible summary: life totals, phase, active seat, the
 * serialisable stack items (so the UI can render the LIFO stack), and the log.
 * Full card state is sent as a separate JSON message ("snapshot") per seat,
 * filtered for hidden-info.
 */
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema'

// ── Per-player state ────────────────────────────────────────────────────────

export class PlayerState extends Schema {
  @type('string')  playerId: string = ''
  @type('string')  displayName: string = 'Player'
  @type('number')  seat: number = 0
  @type('number')  life: number = 40
  @type('number')  poison: number = 0
  @type('boolean') connected: boolean = true
  @type('boolean') lost: boolean = false
  @type('number')  handCount: number = 7   // hidden-info count for opponents
  @type('number')  libraryCount: number = 99
  // Draft-select fields (§55)
  @type('boolean') isHost: boolean = false
  @type('boolean') lockedIn: boolean = false
  @type('string')  deckName: string = ''
  @type('number')  bracketNumber: number = 0
  @type('string')  bracketSubRating: string = ''  // 'U' | 'L' | ''
}

// ── Stack item (serialisable summary for the LIFO stack panel) ───────────────

export class StackItemState extends Schema {
  @type('string') id: string = ''
  @type('string') kind: string = 'spell'       // spell | ability | triggered
  @type('string') source: string = ''          // card instanceId or ''
  @type('string') sourceName: string = ''      // human name for UI
  @type('number') controllerSeat: number = 0
}

// ── Combat state ─────────────────────────────────────────────────────────────

export class CombatState extends Schema {
  @type('boolean') active: boolean = false
  @type('number')  attackingSeat: number = 0
  @type('number')  defendingSeat: number = 1
  @type('string')  subStep: string = 'none'   // none | declareAttackers | declareBlockers | damage
}

// ── Room state ───────────────────────────────────────────────────────────────

export class GameRoomState extends Schema {
  @type('number')
  tick: number = 0

  @type('string')
  roomId: string = ''

  @type('string')
  phase: string = 'main1'

  @type('number')
  activePlayer: number = 0

  @type('number')
  turnNumber: number = 1

  @type('boolean')
  started: boolean = false

  /** Set when host fires startGame (§55). Clients navigate to /play. */
  @type('boolean')
  gameStarted: boolean = false

  /** Total expected seats for this game (§54). */
  @type('number')
  seats: number = 4

  /** Manual mode: server owns state but does NOT auto-resolve stack/steps. */
  @type('boolean')
  manualMode: boolean = false

  @type({ map: PlayerState })
  players = new MapSchema<PlayerState>()

  /** LIFO stack items — rendered by the Stack panel (item 30). */
  @type([StackItemState])
  stack = new ArraySchema<StackItemState>()

  @type(CombatState)
  combat = new CombatState()

  @type(['string'])
  log = new ArraySchema<string>()

  // Seat that currently holds priority (helps UI highlight whose turn it is)
  @type('number')
  prioritySeat: number = 0

  /** Number of spectators currently watching (shown in SpectatorView "N watching" banner). */
  @type('number')
  spectatorCount: number = 0

  /** Whether a game-over has been broadcast (guard against double-fire). */
  @type('boolean')
  gameOverFired: boolean = false
}

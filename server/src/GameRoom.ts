/**
 * Sigil — GameRoom (Colyseus Room) — Phase 3
 *
 * Server-authoritative game room. One instance = one Commander game (up to 4 seats).
 * The engine (table-core + engine-core + rules-*) owns all game state.
 * Clients send typed INTENTS; the server runs them through the engine and
 * broadcasts per-seat SNAPSHOTS (hidden-info filtered).
 *
 * Intent flow:
 *   client --intent--> GameRoom.handleIntent()
 *                        -> engine dispatch / advance
 *                        -> syncSchema()        (updates Colyseus schema for diff broadcast)
 *                        -> broadcastSnapshots() (full filtered card state per seat, JSON)
 *
 * Manual/Auto toggle (item 31):
 *   manualMode=true  -> server owns state, does NOT auto-resolve stack or advance steps.
 *   manualMode=false -> server auto-runs untap/draw/cleanup/SBAs on passTurn.
 */

import { Room, Client } from 'colyseus'
import {
  GameRoomState,
  PlayerState,
  StackItemState,
  CombatState,
} from './schema.js'
import {
  type EngineState,
  type AttackPair,
  createEngineState,
  dispatch,
  advance,
  passPriority,
  detectSBAs,
  buildSeatSnapshot,
  buildSpectatorSnapshot,
  runCombat,
  applyCommanderTax,
  commanderTaxCost,
  performStep,
  STEPS,
} from './engine/index.js'

// ── Intent types (client -> server) ─────────────────────────────────────────

interface IntentBase { type: string }

interface JoinGameIntent extends IntentBase {
  type: 'joinGame'
  displayName: string
  deck?: Array<{ instanceId?: string; cardId?: string; name?: string; isCommander?: boolean }>
}

interface SetLifeIntent extends IntentBase {
  type: 'setLife'
  delta: number
}

interface PassTurnIntent extends IntentBase {
  type: 'passTurn'
}

interface PassPriorityIntent extends IntentBase {
  type: 'passPriority'
}

interface SetManualModeIntent extends IntentBase {
  type: 'setManualMode'
  manual: boolean
}

// Stack intents (item 30)
interface StackPushIntent extends IntentBase {
  type: 'stackPush'
  id: string
  kind: 'spell' | 'ability' | 'triggered'
  source: string
  sourceName: string
  effects?: unknown[]
  targets?: unknown[]
}

interface StackResolveIntent extends IntentBase {
  type: 'stackResolve'
}

interface StackRemoveIntent extends IntentBase {
  type: 'stackRemove'
  id: string
}

interface StackReorderIntent extends IntentBase {
  type: 'stackReorder'
  orderedIds: string[]
}

// Card intents
interface CardMoveIntent extends IntentBase {
  type: 'cardMove'
  instanceId: string
  toZone: string
  x?: number
  y?: number
}

interface CardTapIntent extends IntentBase {
  type: 'cardTap'
  instanceId: string
  tapped?: boolean
}

interface UntapAllIntent extends IntentBase {
  type: 'untapAll'
}

interface DrawIntent extends IntentBase {
  type: 'draw'
  count?: number
}

interface CardCounterIntent extends IntentBase {
  type: 'cardCounter'
  instanceId: string
  kind: string
  delta: number
}

interface BoardWipeIntent extends IntentBase {
  type: 'boardWipe'
}

interface UndoLastIntent extends IntentBase {
  type: 'undoLast'
}

// Combat intents (item 38)
interface DeclareAttackersIntent extends IntentBase {
  type: 'declareAttackers'
  attackPlan: AttackPair[]
}

interface DeclareBlockersIntent extends IntentBase {
  type: 'declareBlockers'
  attackPlan: AttackPair[]
}

interface ResolveCombatIntent extends IntentBase {
  type: 'resolveCombat'
}

// Targeting (item 39)
interface TargetIntent extends IntentBase {
  type: 'target'
  sourceId: string
  targetId: string
  targetKind: 'card' | 'player'
  targetSeat?: number
}

// Test echo
interface TestIntent extends IntentBase {
  type: 'test'
  payload: unknown
}

// P5 new intents (§55–58)
interface ChatIntent extends IntentBase {
  type: 'chat'
  text: string
}

interface LockInIntent extends IntentBase {
  type: 'lockIn'
  deckName?: string
  bracketNumber?: number
  bracketSubRating?: 'U' | 'L' | null
}

interface StartGameIntent extends IntentBase {
  type: 'startGame'
}

// ── #76 new intents ──────────────────────────────────────────────────────────

interface DiceRollIntent extends IntentBase {
  type: 'diceRoll'
  kind: 'dice' | 'coin'
  sides?: number    // for dice
  result: number | string
}

interface VoiceOfferIntent extends IntentBase {
  type: 'voiceOffer'
  toSeat: number
  sdp: string
}

interface VoiceAnswerIntent extends IntentBase {
  type: 'voiceAnswer'
  toSeat: number
  sdp: string
}

interface VoiceIceIntent extends IntentBase {
  type: 'voiceIce'
  toSeat: number
  candidate: string
}

type Intent =
  | JoinGameIntent | SetLifeIntent | PassTurnIntent | PassPriorityIntent
  | SetManualModeIntent | StackPushIntent | StackResolveIntent | StackRemoveIntent
  | StackReorderIntent | CardMoveIntent | CardTapIntent | UntapAllIntent
  | DrawIntent | CardCounterIntent | BoardWipeIntent | UndoLastIntent
  | DeclareAttackersIntent | DeclareBlockersIntent | ResolveCombatIntent
  | TargetIntent | TestIntent
  | ChatIntent | LockInIntent | StartGameIntent
  | DiceRollIntent | VoiceOfferIntent | VoiceAnswerIntent | VoiceIceIntent

// ── Room ─────────────────────────────────────────────────────────────────────

export class GameRoom extends Room<GameRoomState> {
  maxClients = 4

  // The authoritative engine state (not in Colyseus schema — too deep for schema diff)
  private estate!: EngineState

  // Pending attack plan during combat declare phase
  private pendingAttackPlan: AttackPair[] = []

  // Undo history: store last engine state for single-undo
  private undoSnapshot: EngineState | null = null
  private undoLogLine: number = -1

  // Replay log: append { seq, t, seat, intent } on every applied intent
  private replayLog: Array<{ seq: number; t: number; seat: number; intent: unknown }> = []
  private replaySeq: number = 0

  // Spectators (§56) — session IDs that joined read-only
  private spectatorSessions: Set<string> = new Set()

  // Draft-select lock-in state (§55)
  private lockedIn: Map<string, boolean> = new Map()

  onCreate(options: Record<string, unknown>) {
    this.setState(new GameRoomState())
    this.state.roomId = this.roomId
    this.state.manualMode = !!(options['manual'] ?? false)
    this.state.seats = Number(options['seats'] ?? 4)

    // Initialize engine with seats=0 (players added as they join)
    // We'll reinitialize properly on first join once we know deck sizes
    this.estate = createEngineState({ seats: 1, deckSize: 0, startingLife: 40 })

    this.onMessage<Intent>('intent', (client, intent) => {
      this.handleIntent(client, intent)
    })

    // Chat messages (§58) — broadcast to all clients including spectators
    this.onMessage<{ text: string }>('chat', (client, msg) => {
      const player = this.state.players.get(client.sessionId)
      const senderName = player?.displayName ?? 'Spectator'
      const payload = { senderName, text: String(msg.text).slice(0, 500) }
      this.broadcast('chat', payload)
      this.state.log.push(`[chat] ${senderName}: ${payload.text}`)
    })

    console.log(`[GameRoom] created ${this.roomId} manual=${this.state.manualMode}`)
  }

  onJoin(client: Client, options: Record<string, unknown>) {
    // Spectator join (§56) — read-only, no seat assigned
    if (options['spectator']) {
      this.spectatorSessions.add(client.sessionId)
      this.state.spectatorCount = this.spectatorSessions.size
      console.log(`[GameRoom] spectator joined: ${client.sessionId}`)
      // Send full public-zones-only snapshot to the spectator
      const snap = buildSpectatorSnapshot(this.estate)
      client.send('snapshot', snap)
      return
    }

    const seat = this.state.players.size
    if (seat >= this.maxClients) throw new Error('Room is full')

    const player = new PlayerState()
    player.playerId    = client.sessionId
    player.displayName = String(options['displayName'] ?? `Player ${seat + 1}`)
    player.seat        = seat
    player.life        = 40
    player.connected   = true
    player.isHost      = seat === 0  // first joiner is host

    this.state.players.set(client.sessionId, player)

    const logLine = `${player.displayName} joined (seat ${seat})`
    this.state.log.push(logLine)
    this.estate.log.push({ t: 'join', seat, displayName: player.displayName })

    if (!this.state.started && this.state.players.size >= 1) {
      this.state.started = true
      // Reinitialize engine with correct seat count
      this.reinitEngine()
    } else if (this.state.started) {
      this.reinitEngine()
    }

    this.syncSchema()
    this.broadcastSnapshots()

    console.log(`[GameRoom] ${logLine}`)
  }

  onLeave(client: Client, _consented: boolean) {
    // Handle spectator leave
    if (this.spectatorSessions.has(client.sessionId)) {
      this.spectatorSessions.delete(client.sessionId)
      this.state.spectatorCount = this.spectatorSessions.size
      return
    }
    const player = this.state.players.get(client.sessionId)
    if (player) {
      player.connected = false
      this.state.log.push(`${player.displayName} disconnected`)
      this.state.tick++
    }
  }

  onDispose() {
    console.log(`[GameRoom] disposed ${this.roomId}`)
  }

  // ── Engine reinitialization ──────────────────────────────────────────────

  private reinitEngine() {
    const seats = this.state.players.size
    // Preserve any existing decks if re-initializing mid-join
    this.estate = createEngineState({
      seats,
      deckSize: 99,
      startingLife: 40,
      seed: this.roomId,
    })
    // Draw opening hands (7 cards each)
    for (let s = 0; s < seats; s++) {
      this.estate = dispatch(this.estate, { t: 'draw', seat: s, count: 7 })
    }
  }

  // ── Intent dispatch ──────────────────────────────────────────────────────

  private handleIntent(client: Client, intent: Intent) {
    // Spectators may not send game intents — they are read-only
    // Exception: chat is handled separately via onMessage('chat') so never reaches here
    if (this.spectatorSessions.has(client.sessionId)) return

    const player = this.state.players.get(client.sessionId)
    if (!player) return

    const seat = player.seat

    switch (intent.type) {

      // ── Join with deck ─────────────────────────────────────────────────
      case 'joinGame': {
        player.displayName = intent.displayName || player.displayName
        if (intent.deck && intent.deck.length) {
          // Re-initialize engine slots with actual deck data
          const allDecks: Array<Array<{instanceId?: string; cardId?: string; name?: string; isCommander?: boolean}>> = []
          for (let s = 0; s < this.state.players.size; s++) allDecks.push([])
          allDecks[seat] = intent.deck
          this.estate = createEngineState({
            seats: this.state.players.size,
            startingLife: 40,
            decks: allDecks,
            seed: this.roomId,
          })
          this.estate = dispatch(this.estate, { t: 'draw', seat, count: 7 })
        }
        this.state.log.push(`${player.displayName} loaded deck`)
        break
      }

      // ── Life ───────────────────────────────────────────────────────────
      case 'setLife': {
        this.saveUndo()
        const lifeSeat = (intent as { seat?: number }).seat ?? seat
        this.estate = dispatch(this.estate, { t: 'adjust_life', seat: lifeSeat, delta: intent.delta })
        const p = this.estate.game.players[lifeSeat]
        const newLife = p ? p.life : 0
        this.state.log.push(`${player.displayName} life ${intent.delta > 0 ? '+' : ''}${intent.delta} → ${newLife}`)
        // Run SBA after life change
        this.estate = advance(this.estate)
        this.checkPlayerLosses()
        this.checkWinner()
        break
      }

      // ── Pass Turn (item 32/33/35) ──────────────────────────────────────
      case 'passTurn': {
        this.saveUndo()
        const fromSeat = this.estate.game.activeSeat
        const fromPlayer = [...this.state.players.values()].find(p => p.seat === fromSeat)

        if (!this.state.manualMode) {
          // Auto mode: run cleanup (discard-to-7), then untap/draw for next player
          this.runAutoTurnTransition(fromSeat)
        } else {
          // Manual mode: just advance active seat
          const nextSeat = (fromSeat + 1) % this.estate.game.seats
          this.estate = dispatch(this.estate, { t: 'pass_turn' })
          this.estate.game.phase = 'untap'
          this.state.log.push(
            `${fromPlayer?.displayName ?? `Seat ${fromSeat}`} passed turn → seat ${nextSeat} (turn ${this.estate.game.turn})`
          )
        }
        break
      }

      // ── Pass Priority ──────────────────────────────────────────────────
      case 'passPriority': {
        if (!this.state.manualMode) {
          this.estate = passPriority(this.estate)
          this.state.log.push(`${player.displayName} passes priority`)
        }
        break
      }

      // ── Manual/Auto toggle (item 31) ───────────────────────────────────
      case 'setManualMode': {
        this.state.manualMode = !!intent.manual
        this.state.log.push(`Engine mode: ${this.state.manualMode ? 'Manual' : 'Auto'}`)
        break
      }

      // ── Stack: push (item 30) ──────────────────────────────────────────
      case 'stackPush': {
        this.saveUndo()
        this.estate = dispatch(this.estate, {
          t: 'stack_push',
          id: intent.id,
          kind: intent.kind,
          source: intent.source,
          controllerSeat: seat,
          effects: intent.effects ?? [],
          targets: intent.targets ?? [],
        })
        this.state.log.push(`${player.displayName} cast/activated: ${intent.sourceName}`)
        break
      }

      // ── Stack: resolve top ─────────────────────────────────────────────
      case 'stackResolve': {
        this.saveUndo()
        if (this.estate.stack.length === 0) break
        this.estate = dispatch(this.estate, { t: 'stack_resolve' })
        this.estate = advance(this.estate)
        this.state.log.push(`Stack: resolved`)
        this.checkPlayerLosses()
        this.checkWinner()
        break
      }

      // ── Stack: remove (counter/fizzle) ─────────────────────────────────
      case 'stackRemove': {
        this.saveUndo()
        // Remove by id without resolving effects
        const idx = this.estate.stack.findIndex(s => s.id === intent.id)
        if (idx >= 0) {
          const removed = this.estate.stack[idx]
          const newStack = [...this.estate.stack]
          newStack.splice(idx, 1)
          // We need to directly mutate via a filtered re-construct (engine doesn't have a remove-by-id,
          // but we can abuse __set to rebuild: use clone path)
          const estateCopy = JSON.parse(JSON.stringify(this.estate)) as EngineState
          estateCopy.stack.splice(idx, 1)
          this.estate = estateCopy
          this.state.log.push(`Stack: removed ${removed?.id ?? intent.id}`)
        }
        break
      }

      // ── Stack: reorder (drag reorder, item 30) ─────────────────────────
      case 'stackReorder': {
        this.saveUndo()
        const ids = intent.orderedIds
        const byId = new Map(this.estate.stack.map(s => [s.id, s]))
        const reordered = ids.map(id => byId.get(id)).filter(Boolean) as typeof this.estate.stack
        const estateCopy = JSON.parse(JSON.stringify(this.estate)) as EngineState
        estateCopy.stack = reordered
        this.estate = estateCopy
        this.state.log.push(`${player.displayName} reordered stack`)
        break
      }

      // ── Card move ──────────────────────────────────────────────────────
      case 'cardMove': {
        this.saveUndo()
        const card = this.estate.game.cards[intent.instanceId]
        if (!card) break

        const prevZone = card.zone
        this.estate = dispatch(this.estate, {
          t: 'card_move',
          instanceId: intent.instanceId,
          toZone: intent.toZone,
          x: intent.x,
          y: intent.y,
        })

        // Commander tax: when a commander moves to command zone from graveyard or exile
        if (card.isCommander && intent.toZone === 'command' &&
            (prevZone === 'graveyard' || prevZone === 'exile')) {
          this.estate = applyCommanderTax(this.estate, intent.instanceId)
          const tax = commanderTaxCost(this.estate, intent.instanceId)
          this.state.log.push(
            `${player.displayName} returned commander to command zone (tax now +${tax})`
          )
        } else {
          this.state.log.push(
            `${player.displayName} moved ${card.name || intent.instanceId} to ${intent.toZone}`
          )
        }

        // Token cleanup: tokens leaving battlefield cease to exist
        if (card.isToken && intent.toZone !== 'battlefield') {
          this.estate = dispatch(this.estate, { t: '__remove', ids: [intent.instanceId] })
        }

        this.estate = advance(this.estate)
        this.checkPlayerLosses()
        this.checkWinner()
        break
      }

      // ── Tap/untap card ─────────────────────────────────────────────────
      case 'cardTap': {
        this.estate = dispatch(this.estate, {
          t: 'card_tap',
          instanceId: intent.instanceId,
          tapped: intent.tapped,
        })
        break
      }

      // ── Untap all (item 35 — skips "doesn't untap" cards) ─────────────
      case 'untapAll': {
        this.saveUndo()
        // The untap_all action in table-core already skips phased cards.
        // For "doesn't untap" text we'd need card defs; for now skip cards
        // with a 'doesNotUntap' annotation counter as a fallback.
        const skipIds = new Set<string>()
        for (const id in this.estate.game.cards) {
          const c = this.estate.game.cards[id]
          if (c.zone === 'battlefield' && c.counters['doesNotUntap']) skipIds.add(id)
        }
        // Untap all then re-tap the skip set
        this.estate = dispatch(this.estate, { t: 'untap_all', seat })
        for (const id of skipIds) {
          this.estate = dispatch(this.estate, { t: 'card_tap', instanceId: id, tapped: true })
        }
        this.state.log.push(`${player.displayName} untapped all`)
        break
      }

      // ── Draw ───────────────────────────────────────────────────────────
      case 'draw': {
        this.saveUndo()
        const count = intent.count ?? 1
        this.estate = dispatch(this.estate, { t: 'draw', seat, count })
        this.state.log.push(`${player.displayName} draws ${count}`)
        break
      }

      // ── Card counter ───────────────────────────────────────────────────
      case 'cardCounter': {
        this.estate = dispatch(this.estate, {
          t: 'card_counter',
          instanceId: intent.instanceId,
          kind: intent.kind,
          delta: intent.delta,
        })
        break
      }

      // ── Play-tab parity intents (set_phase/counters/tokens/etc.) ─────────
      case 'setPhase': {
        this.estate = dispatch(this.estate, { t: 'set_phase', phase: intent.phase })
        break
      }
      case 'playerCounter': {
        this.estate = dispatch(this.estate, { t: 'player_counter', seat: intent.seat, kind: intent.kind, delta: intent.delta })
        break
      }
      case 'commanderDamage': {
        this.estate = dispatch(this.estate, { t: 'commander_damage', seat: intent.seat, fromSeat: intent.fromSeat, fromCmd: intent.fromCmd, delta: intent.delta })
        break
      }
      case 'createToken': {
        this.estate = dispatch(this.estate, { t: 'token_create', instanceId: intent.instanceId, cardId: intent.cardId, name: intent.name, ownerSeat: intent.ownerSeat, x: intent.x, y: intent.y })
        break
      }
      case 'cardFlip': {
        this.estate = dispatch(this.estate, { t: 'card_flip', instanceId: intent.instanceId, faceDown: intent.faceDown })
        break
      }
      case 'cardTransform': {
        this.estate = dispatch(this.estate, { t: 'card_transform', instanceId: intent.instanceId })
        break
      }
      case 'cardClone': {
        this.estate = dispatch(this.estate, { t: 'card_clone', fromId: intent.fromId, instanceId: intent.instanceId, x: intent.x, y: intent.y })
        break
      }
      case 'shuffle': {
        this.estate = dispatch(this.estate, { t: 'library_shuffle', seat: intent.seat })
        break
      }
      case 'mill': {
        this.estate = dispatch(this.estate, { t: 'mill', seat: intent.seat, count: intent.count })
        break
      }

      // ── Board wipe (item 37) ───────────────────────────────────────────
      case 'boardWipe': {
        this.saveUndo()
        const toGrave: string[] = []
        for (const id in this.estate.game.cards) {
          const c = this.estate.game.cards[id]
          if (c.zone === 'battlefield' && !c.isToken) toGrave.push(id)
        }
        const toRemove: string[] = []
        for (const id in this.estate.game.cards) {
          const c = this.estate.game.cards[id]
          if (c.zone === 'battlefield' && c.isToken) toRemove.push(id)
        }
        for (const id of toGrave) {
          this.estate = dispatch(this.estate, { t: 'card_move', instanceId: id, toZone: 'graveyard' })
        }
        if (toRemove.length) {
          this.estate = dispatch(this.estate, { t: '__remove', ids: toRemove })
        }
        this.estate = advance(this.estate)
        this.checkPlayerLosses()
        this.checkWinner()
        this.state.log.push(`${player.displayName} cast a board wipe`)
        break
      }

      // ── Undo last (item 37) ────────────────────────────────────────────
      case 'undoLast': {
        if (this.undoSnapshot) {
          this.estate = this.undoSnapshot
          this.undoSnapshot = null
          // Grey out the last log line
          if (this.state.log.length > 0) {
            const last = this.state.log[this.state.log.length - 1]
            this.state.log[this.state.log.length - 1] = last + ' (undone)'
          }
          this.state.log.push(`${player.displayName} undid last action`)
        }
        break
      }

      // ── Combat: declare attackers (item 38) ────────────────────────────
      case 'declareAttackers': {
        this.saveUndo()
        this.pendingAttackPlan = intent.attackPlan
        this.state.combat.active = true
        this.state.combat.attackingSeat = seat
        this.state.combat.defendingSeat = (seat + 1) % this.estate.game.seats
        this.state.combat.subStep = 'declareBlockers'

        // Mark attackers as attacking
        for (const pair of intent.attackPlan) {
          this.estate = dispatch(this.estate, {
            t: 'card_combat',
            instanceId: pair.attacker,
            attacking: true,
          })
        }

        this.estate = dispatch(this.estate, { t: 'set_phase', phase: 'attackers' })
        this.state.log.push(
          `${player.displayName} declared ${intent.attackPlan.length} attacker(s)`
        )
        break
      }

      // ── Combat: declare blockers ────────────────────────────────────────
      case 'declareBlockers': {
        this.pendingAttackPlan = intent.attackPlan
        this.state.combat.subStep = 'damage'
        this.estate = dispatch(this.estate, { t: 'set_phase', phase: 'blockers' })
        this.state.log.push(`${player.displayName} declared blockers`)
        break
      }

      // ── Combat: resolve damage ──────────────────────────────────────────
      case 'resolveCombat': {
        const defSeat = this.state.combat.defendingSeat
        this.estate = runCombat(this.estate, defSeat, this.pendingAttackPlan)

        // Clear attacking flags
        for (const id in this.estate.game.cards) {
          if (this.estate.game.cards[id].attacking) {
            this.estate = dispatch(this.estate, { t: 'card_combat', instanceId: id, attacking: false })
          }
        }

        this.estate = dispatch(this.estate, { t: 'set_phase', phase: 'endCombat' })
        this.state.combat.active = false
        this.state.combat.subStep = 'none'
        this.pendingAttackPlan = []

        this.estate = advance(this.estate)
        this.checkPlayerLosses()
        this.checkWinner()
        this.state.log.push(`${player.displayName} resolved combat`)
        break
      }

      // ── Targeting annotation (item 39) ─────────────────────────────────
      case 'target': {
        // Store targeting as an annotation for the UI to render arrows
        const annoId = `target-${intent.sourceId}-${Date.now()}`
        this.estate = dispatch(this.estate, {
          t: 'annotation_create',
          id: annoId,
          kind: 'target',
          text: `${intent.sourceId} -> ${intent.targetId}`,
          x: 0,
          y: 0,
          seat,
        })
        this.state.log.push(
          `${player.displayName} targeted ${intent.targetId} with ${intent.sourceId}`
        )
        break
      }

      // ── Test echo ──────────────────────────────────────────────────────
      case 'test': {
        this.state.log.push(`[test] from ${player.displayName}: ${JSON.stringify(intent.payload)}`)
        client.send('testAck', { received: intent.payload, tick: this.state.tick })
        break
      }

      // ── Chat (§58) — handled at room level above; this catches duplicates ──
      case 'chat': {
        // Already handled by onMessage('chat'); no-op here
        break
      }

      // ── Draft-select: lock in deck + bracket (§55) ────────────────────
      case 'lockIn': {
        player.deckName        = intent.deckName ?? ''
        player.bracketNumber   = intent.bracketNumber ?? 0
        player.bracketSubRating = intent.bracketSubRating ?? ""
        player.lockedIn        = true
        this.lockedIn.set(client.sessionId, true)
        this.state.log.push(`${player.displayName} locked in (B${intent.bracketNumber ?? '?'})`)
        this.syncSchema()
        this.broadcastSnapshots()
        return  // don't bump tick twice
      }

      // ── Start game (§55 host button) ─────────────────────────────────
      case 'startGame': {
        // Only host (seat 0) can start
        if (player.seat !== 0) break
        const allLocked = [...this.state.players.values()].every(p => p.lockedIn)
        if (!allLocked) break
        this.state.gameStarted = true
        // Notify all clients — they navigate to /play?roomId=<id>
        this.broadcast('gameStarted', { gameId: this.roomId })
        this.state.log.push('Game started!')
        break
      }

      // ── Dice roll broadcast (#76) ─────────────────────────────────────
      case 'diceRoll': {
        const label = intent.kind === 'coin'
          ? `${player.displayName} flipped a coin → ${intent.result}`
          : `${player.displayName} rolled d${intent.sides ?? '?'} → ${intent.result}`
        this.state.log.push(label)
        // Relay to all clients including spectators
        this.broadcast('diceRoll', {
          seat: seat,
          kind: intent.kind,
          sides: intent.sides,
          result: intent.result,
        })
        break
      }

      // ── Voice signalling relay (#76) ──────────────────────────────────
      // The server is a pure relay — no SDP/ICE processing.
      // TODO: Add TURN server support via VITE_TURN_URL for cross-NAT connections
      //       (LAN play works fine peer-to-peer; public internet needs TURN).
      case 'voiceOffer':
      case 'voiceAnswer':
      case 'voiceIce': {
        const targetSeat = intent.toSeat
        for (const [sid, p] of this.state.players.entries()) {
          if (p.seat === targetSeat) {
            const targetClient = this.clients.find((c) => c.sessionId === sid)
            if (targetClient) {
              targetClient.send(intent.type, {
                fromSeat: seat,
                ...(intent.type === 'voiceIce'
                  ? { candidate: (intent as VoiceIceIntent).candidate }
                  : { sdp: (intent as VoiceOfferIntent | VoiceAnswerIntent).sdp }),
              })
            }
            break
          }
        }
        break
      }

      default: {
        const _exhaustive = intent as { type: string }
        console.warn(`[GameRoom] unknown intent type:`, _exhaustive.type)
      }
    }

    // Record intent in replay log (seat already resolved above)
    this.appendReplay(seat, intent)

    // Bump tick; sync schema; broadcast per-seat snapshots
    this.state.tick++
    this.syncSchema()
    this.broadcastSnapshots()
  }

  // ── Auto turn transition ──────────────────────────────────────────────────

  private runAutoTurnTransition(fromSeat: number) {
    // 1. Cleanup: discard to 7 (emit needsDiscard if hand > 7)
    const handCards = Object.values(this.estate.game.cards)
      .filter(c => c.ownerSeat === fromSeat && c.zone === 'hand')
    const handSize = handCards.length

    // Check if any permanent lifts hand size limit (simple: check annotation)
    const unlimitedHand = Object.values(this.estate.game.cards).some(
      c => c.zone === 'battlefield' && c.counters['unlimitedHand']
    )

    if (!unlimitedHand && handSize > 7) {
      // Signal client to choose discard; server waits (in real flow client would
      // send a 'discardToHandSize' intent — for now auto-discard the newest cards)
      const toDiscard = handCards.slice(7)
      for (const card of toDiscard) {
        this.estate = dispatch(this.estate, {
          t: 'card_move',
          instanceId: card.instanceId,
          toZone: 'graveyard',
        })
      }
      this.state.log.push(`Seat ${fromSeat} discarded to hand size (${handSize} -> 7)`)
    }

    // 2. Move to next player
    const nextSeat = (fromSeat + 1) % this.estate.game.seats
    this.estate = dispatch(this.estate, { t: 'pass_turn' })

    // 3. Untap
    this.estate = performStep(this.estate, 'untap')

    // 4. Draw (skip on first turn of the game for the first player)
    const isFirstTurn = this.estate.game.turn === 1 && nextSeat === 0
    if (!isFirstTurn) {
      this.estate = performStep(this.estate, 'draw')
    }

    this.estate.game.phase = 'main1'

    const fromPlayerName = [...this.state.players.values()].find(p => p.seat === fromSeat)?.displayName ?? `Seat ${fromSeat}`
    const nextPlayerName = [...this.state.players.values()].find(p => p.seat === nextSeat)?.displayName ?? `Seat ${nextSeat}`
    this.state.log.push(
      `${fromPlayerName} passed turn → ${nextPlayerName} (turn ${this.estate.game.turn})`
    )
  }

  // ── SBA: check/flag player losses ─────────────────────────────────────────

  private checkPlayerLosses() {
    const findings = detectSBAs(this.estate.game)
    for (const f of findings) {
      if (f.kind === 'player_loss' && f.seat != null) {
        for (const player of this.state.players.values()) {
          if (player.seat === f.seat && !player.lost) {
            player.lost = true
            this.state.log.push(`Seat ${f.seat} lost! (${f.rule}: ${f.message})`)
          }
        }
      }
    }
  }

  // ── Winner check: fires gameOver when one non-eliminated seat remains ──────

  private checkWinner() {
    const players = [...this.state.players.values()]
    if (players.length < 2) return  // need 2+ to have a winner
    const alive = players.filter((p) => !p.lost)
    if (alive.length !== 1) return  // not done yet

    const winner = alive[0]!
    const winnerSeat = winner.seat

    // Build placements (winner = place 1; losers sorted by when they lost — approximate with seat order)
    const losers = players.filter((p) => p.lost).sort((a, b) => a.seat - b.seat)
    const placements = [
      { seat: winnerSeat, userId: winner.playerId, displayName: winner.displayName, place: 1 },
      ...losers.map((p, i) => ({ seat: p.seat, userId: p.playerId, displayName: p.displayName, place: i + 2 })),
    ]

    this.state.log.push(`Game over! ${winner.displayName} wins!`)
    this.broadcast('gameOver', { winnerSeat, placements })

    // Guard: only broadcast replayReady once
    if (!this.state.gameOverFired) {
      this.state.gameOverFired = true
      // Build player meta for replay header
      const playerMeta = [...this.state.players.values()].map(p => ({
        seat: p.seat,
        userId: p.playerId,
        displayName: p.displayName,
      }))
      // Broadcast full replay log — client persists to match_replays table
      this.broadcast('replayReady', {
        gameId: this.roomId,
        winnerSeat,
        players: playerMeta,
        intentLog: this.replayLog,
      })
    }

    console.log(`[GameRoom] gameOver — winner seat ${winnerSeat}`)
  }

  // ── Sync Colyseus schema from engine state ────────────────────────────────

  private syncSchema() {
    // Life totals & hand/library counts
    for (const player of this.state.players.values()) {
      const ep = this.estate.game.players[player.seat]
      if (!ep) continue
      player.life = ep.life

      // Hidden info counts
      let hand = 0, library = 0
      for (const id in this.estate.game.cards) {
        const c = this.estate.game.cards[id]
        if (c.ownerSeat !== player.seat) continue
        if (c.zone === 'hand') hand++
        if (c.zone === 'library') library++
      }
      player.handCount    = hand
      player.libraryCount = library
    }

    // Phase / active seat / turn
    this.state.phase        = this.estate.game.phase ?? 'main1'
    this.state.activePlayer = this.estate.game.activeSeat
    this.state.turnNumber   = this.estate.game.turn
    this.state.prioritySeat = this.estate.priority

    // Stack (LIFO — item 30)
    this.state.stack.clear()
    for (const item of this.estate.stack) {
      const si = new StackItemState()
      si.id             = item.id
      si.kind           = item.kind
      si.source         = item.source ?? ''
      si.sourceName     = (this.estate.game.cards[item.source ?? '']?.name) ?? item.id
      si.controllerSeat = item.controllerSeat
      this.state.stack.push(si)
    }
  }

  // ── Per-seat snapshot broadcast ───────────────────────────────────────────

  private broadcastSnapshots() {
    for (const [sessionId, player] of this.state.players.entries()) {
      const client = this.clients.find(c => c.sessionId === sessionId)
      if (!client) continue
      const snap = buildSeatSnapshot(this.estate, player.seat)
      client.send('snapshot', snap)
    }
    // Spectators get public-zones-only snapshot (no hidden card identities for any seat)
    const spectatorSnap = buildSpectatorSnapshot(this.estate)
    for (const sessionId of this.spectatorSessions) {
      const client = this.clients.find(c => c.sessionId === sessionId)
      if (!client) continue
      client.send('snapshot', spectatorSnap)
    }
  }

  // ── Replay log append ────────────────────────────────────────────────────────

  private appendReplay(seat: number, intent: unknown) {
    this.replayLog.push({ seq: this.replaySeq++, t: Date.now(), seat, intent })
  }

  // ── Undo support ──────────────────────────────────────────────────────────

  private saveUndo() {
    this.undoSnapshot = JSON.parse(JSON.stringify(this.estate)) as EngineState
    this.undoLogLine  = this.state.log.length
  }
}

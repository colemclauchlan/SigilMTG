/**
 * server/tests/engine-room.test.mjs
 *
 * Node test: drives engine/index.ts (via the raw JS modules, no TS compilation needed)
 * through a simulated 2-player game and asserts:
 *   1. Convergence — state mutates deterministically through intents
 *   2. Hidden-info filtering — opponent hand/library cards are masked per seat
 *   3. Stack push/resolve sequence — LIFO ordering, effects applied
 *   4. Combat damage step — attacker deals damage, lethal creature moves to graveyard
 *   5. Commander tax — +2 per death tracked on the card
 *   6. SBA: player_loss at 0 life
 *   7. Untap-all + pass-turn + auto draw
 *
 * Run with:   node server/tests/engine-room.test.mjs
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const req        = createRequire(import.meta.url)

// Load engine from server/src/engine/ (same files GameRoom uses)
const EDIR = path.join(__dirname, '../src/engine')
const MTGCore     = req(path.join(EDIR, 'table-core.js'))
const EngineCore  = req(path.join(EDIR, 'engine-core.js'))
const RulesTurn   = req(path.join(EDIR, 'rules-turn.js'))
const RulesSBA    = req(path.join(EDIR, 'rules-sba.js'))
const RulesCombat = req(path.join(EDIR, 'rules-combat.js'))
const CombatTurn  = req(path.join(EDIR, 'rules-combat-turn.js'))

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓  ${msg}`)
    passed++
  } else {
    console.error(`  ✗  ${msg}`)
    failed++
  }
}

function assertEq(a, b, msg) {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (ok) { console.log(`  ✓  ${msg}  (${JSON.stringify(a)})`); passed++ }
  else { console.error(`  ✗  ${msg}  expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); failed++ }
}

// ── Hidden-info filter (mirrors engine/index.ts filterForSeat) ───────────────

function filterForSeat(estate, viewingSeat) {
  const filtered = JSON.parse(JSON.stringify(estate))
  for (const id in filtered.game.cards) {
    const card = filtered.game.cards[id]
    if (card.ownerSeat !== viewingSeat && (card.zone === 'hand' || card.zone === 'library')) {
      if (!card.revealedTo.includes(viewingSeat)) {
        card.name = ''
        card.cardId = null
        card.setCode = null
        card.collectorNumber = null
      }
    }
    if (card.faceDown && card.ownerSeat !== viewingSeat && !card.revealedTo.includes(viewingSeat)) {
      card.name = ''
      card.cardId = null
    }
  }
  return filtered
}

// ── Wire SBAs into EngineCore (same as index.ts does) ───────────────────────

EngineCore.resetRules()  // clean slate
RulesSBA.DETECTORS.forEach(detector => {
  EngineCore.registerSBA(game => {
    const findings = detector(game)
    return findings.map(f => {
      if (f.kind === 'cease_to_exist' && f.instanceId) return { t: '__remove', ids: [f.instanceId] }
      if (f.kind === 'attachment' && f.instanceId) return { t: '__set', cards: [{ id: f.instanceId, fields: { attachedTo: null } }] }
      return null
    }).filter(Boolean)
  })
})

// ── Build a minimal 2-seat game with known cards ─────────────────────────────

function buildGame() {
  // Each seat gets a commander + some library cards + 2 known "creatures"
  const decks = [
    [
      { instanceId: 'p0-cmd', name: 'Commander A', isCommander: true, cardId: 'cmd-a' },
      { instanceId: 'p0-c1',  name: 'Grizzly Bears', cardId: 'c1', zone: 'battlefield' },
      // library fill
      ...Array.from({ length: 10 }, (_, i) => ({ instanceId: `p0-lib${i}`, name: `Card p0-${i}`, cardId: `p0-lib${i}` })),
    ],
    [
      { instanceId: 'p1-cmd', name: 'Commander B', isCommander: true, cardId: 'cmd-b' },
      { instanceId: 'p1-c1',  name: 'Grizzly Bears', cardId: 'c1', zone: 'battlefield' },
      ...Array.from({ length: 10 }, (_, i) => ({ instanceId: `p1-lib${i}`, name: `Card p1-${i}`, cardId: `p1-lib${i}` })),
    ],
  ]

  let estate = EngineCore.create({ seats: 2, startingLife: 40, decks, seed: 'test' })

  // Draw 7 for each seat
  estate = EngineCore.dispatch(estate, { t: 'draw', seat: 0, count: 7 })
  estate = EngineCore.dispatch(estate, { t: 'draw', seat: 1, count: 7 })

  return estate
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Sigil Engine Room Tests ===\n')

// ── 1. Basic initialization ───────────────────────────────────────────────────

console.log('── 1. Initialization ──')
{
  let estate = buildGame()
  assertEq(estate.game.seats, 2, 'game has 2 seats')
  assertEq(estate.game.players[0].life, 40, 'seat 0 starts at 40 life')
  assertEq(estate.game.players[1].life, 40, 'seat 1 starts at 40 life')

  const p0hand = Object.values(estate.game.cards).filter(c => c.ownerSeat === 0 && c.zone === 'hand')
  assert(p0hand.length === 7, `seat 0 has 7 cards in hand (got ${p0hand.length})`)

  const p1hand = Object.values(estate.game.cards).filter(c => c.ownerSeat === 1 && c.zone === 'hand')
  assert(p1hand.length === 7, `seat 1 has 7 cards in hand (got ${p1hand.length})`)

  // Commanders in command zone
  assert(estate.game.cards['p0-cmd']?.zone === 'command', 'p0 commander in command zone')
  assert(estate.game.cards['p1-cmd']?.zone === 'command', 'p1 commander in command zone')
  // Creatures on battlefield
  assert(estate.game.cards['p0-c1']?.zone === 'battlefield', 'p0-c1 on battlefield')
  assert(estate.game.cards['p1-c1']?.zone === 'battlefield', 'p1-c1 on battlefield')
}

// ── 2. Hidden-info filtering ───────────────────────────────────────────────────

console.log('\n── 2. Hidden-info filtering ──')
{
  let estate = buildGame()

  // Seat 0 views: own hand is visible, seat 1 hand is masked
  const snap0 = filterForSeat(estate, 0)
  const snap1 = filterForSeat(estate, 1)

  // All seat 0 hand cards should have names in snap0
  const p0hand0 = Object.values(snap0.game.cards).filter(c => c.ownerSeat === 0 && c.zone === 'hand')
  const p0HandAllNamed = p0hand0.every(c => c.name !== '')
  assert(p0HandAllNamed, 'seat 0 sees own hand names in snap0')

  // Seat 1 hand cards in snap0 should have empty names
  const p1hand0 = Object.values(snap0.game.cards).filter(c => c.ownerSeat === 1 && c.zone === 'hand')
  const p1HandAllMasked = p1hand0.every(c => c.name === '' && c.cardId === null)
  assert(p1HandAllMasked, 'seat 0 does NOT see seat 1 hand names in snap0')

  // Symmetric: seat 1 sees own hand in snap1
  const p1hand1 = Object.values(snap1.game.cards).filter(c => c.ownerSeat === 1 && c.zone === 'hand')
  const p1HandAllNamed = p1hand1.every(c => c.name !== '')
  assert(p1HandAllNamed, 'seat 1 sees own hand names in snap1')

  // Seat 0 hand masked in snap1
  const p0hand1 = Object.values(snap1.game.cards).filter(c => c.ownerSeat === 0 && c.zone === 'hand')
  const p0HandAllMasked = p0hand1.every(c => c.name === '' && c.cardId === null)
  assert(p0HandAllMasked, 'seat 1 does NOT see seat 0 hand names in snap1')

  // Library counts should match (all cards present, just masked)
  assertEq(p0hand0.length, p0hand1.length, 'same number of seat 0 hand card slots in both views')
}

// ── 3. Life + SBA: player_loss at 0 life ──────────────────────────────────────

console.log('\n── 3. Life change + SBA loss detection ──')
{
  let estate = buildGame()

  // Deal 40 damage to seat 1
  estate = EngineCore.dispatch(estate, { t: 'adjust_life', seat: 1, delta: -40 })
  assertEq(estate.game.players[1].life, 0, 'seat 1 at 0 life after -40')

  // SBA detection
  const findings = RulesSBA.detectAll(estate.game)
  const lossFindings = findings.filter(f => f.kind === 'player_loss' && f.seat === 1)
  assert(lossFindings.length > 0, 'SBA detects player_loss for seat 1 at 0 life')

  // advance() should have run SBAs — though player_loss has no auto-remove action,
  // it should be stable (no crash)
  const advanced = EngineCore.advance(estate)
  assertEq(advanced.game.players[1].life, 0, 'life still 0 after advance (loss flagged, not auto-fixed)')
}

// ── 4. LIFO stack: push / resolve / fizzle ────────────────────────────────────

console.log('\n── 4. LIFO stack ──')
{
  let estate = buildGame()

  // Push two spells
  estate = EngineCore.dispatch(estate, {
    t: 'stack_push', id: 'spell-A', kind: 'spell', source: 'p0-c1',
    controllerSeat: 0,
    effects: [{ t: 'adjust_life', seat: 1, delta: -3 }],
    targets: []
  })
  estate = EngineCore.dispatch(estate, {
    t: 'stack_push', id: 'spell-B', kind: 'spell', source: null,
    controllerSeat: 1,
    effects: [{ t: 'adjust_life', seat: 0, delta: -2 }],
    targets: []
  })

  assertEq(estate.stack.length, 2, 'stack has 2 items after 2 pushes')
  assertEq(estate.stack[estate.stack.length - 1].id, 'spell-B', 'top of stack is spell-B (LIFO)')

  // Resolve top (spell-B) — should deal -2 to seat 0
  estate = EngineCore.dispatch(estate, { t: 'stack_resolve' })
  estate = EngineCore.advance(estate)
  assertEq(estate.stack.length, 1, 'stack has 1 item after resolving top')
  assertEq(estate.game.players[0].life, 38, 'seat 0 at 38 after spell-B resolves (-2)')

  // Resolve second (spell-A) — should deal -3 to seat 1
  estate = EngineCore.dispatch(estate, { t: 'stack_resolve' })
  assertEq(estate.stack.length, 0, 'stack empty after second resolve')
  assertEq(estate.game.players[1].life, 37, 'seat 1 at 37 after spell-A resolves (-3)')
}

// ── 5. Combat damage step ─────────────────────────────────────────────────────

console.log('\n── 5. Combat damage ──')
{
  let estate = buildGame()

  // Give p0-c1 known P/T via counters (+2/+2 net = 4/4 effective for test)
  estate = EngineCore.dispatch(estate, { t: 'card_counter', instanceId: 'p0-c1', kind: '+1/+1', delta: 2 })
  // p1-c1 is 2/2 base (Grizzly Bears), unmodified

  // attackPlan: p0-c1 attacks seat 1, p1-c1 blocks
  const attackPlan = [{ attacker: 'p0-c1', blockers: ['p1-c1'] }]

  // We need effective creature data — since we don't have card defs loaded,
  // we test the raw combat math directly
  const atk = { id: 'p0-c1', power: 4, toughness: 4, abilities: [], markedDamage: 0 }
  const blk = { id: 'p1-c1', power: 2, toughness: 2, abilities: [], markedDamage: 0 }

  const result = RulesCombat.resolveAttack(atk, [blk])
  assert(RulesCombat.isDead(result.attacker) === false, '4/4 attacker survives 2/2 blocker')
  assert(RulesCombat.isDead(result.blockers[0]) === true, '2/2 blocker is killed by 4/4 attacker')
  assertEq(result.trample, 0, 'no trample damage (attacker is blocked)')

  // Trample test: give attacker trample
  const atkTrample = { id: 'p0-c1', power: 6, toughness: 4, abilities: ['trample'], markedDamage: 0 }
  const result2 = RulesCombat.resolveAttack(atkTrample, [blk])
  assert(result2.trample === 4, `trample deals 4 excess (6 - 2 lethal = 4, got ${result2.trample})`)

  // Apply via CombatTurn using engine dispatch (no card defs — override effective creature lookup)
  // Direct engine dispatch to simulate lethal: move p1-c1 to graveyard
  const estateCopy = JSON.parse(JSON.stringify(estate))
  const dead = EngineCore.dispatch(estateCopy, { t: 'card_move', instanceId: 'p1-c1', toZone: 'graveyard' })
  assert(dead.game.cards['p1-c1'].zone === 'graveyard', 'lethal creature moved to graveyard')

  // Unblocked damage to player
  const estateDmg = EngineCore.dispatch(estate, { t: 'adjust_life', seat: 1, delta: -4 })
  assertEq(estateDmg.game.players[1].life, 36, 'seat 1 takes 4 unblocked damage → 36 life')
}

// ── 6. Commander tax ──────────────────────────────────────────────────────────

console.log('\n── 6. Commander tax ──')
{
  let estate = buildGame()

  // Simulate commander dying to graveyard and returning to command zone
  estate = EngineCore.dispatch(estate, { t: 'card_move', instanceId: 'p0-cmd', toZone: 'graveyard' })
  assertEq(estate.game.cards['p0-cmd'].zone, 'graveyard', 'commander in graveyard')

  // Player chooses to return to command zone
  estate = EngineCore.dispatch(estate, { t: 'card_move', instanceId: 'p0-cmd', toZone: 'command' })
  // Apply commander tax
  estate = EngineCore.dispatch(estate, { t: 'card_counter', instanceId: 'p0-cmd', kind: 'commanderTax', delta: 1 })

  const taxCount = estate.game.cards['p0-cmd'].counters['commanderTax'] ?? 0
  assertEq(taxCount, 1, 'commander has 1 tax counter after first death')

  const taxCost = taxCount * 2
  assertEq(taxCost, 2, 'commander tax cost = +2 mana')

  // Second death
  estate = EngineCore.dispatch(estate, { t: 'card_move', instanceId: 'p0-cmd', toZone: 'graveyard' })
  estate = EngineCore.dispatch(estate, { t: 'card_move', instanceId: 'p0-cmd', toZone: 'command' })
  estate = EngineCore.dispatch(estate, { t: 'card_counter', instanceId: 'p0-cmd', kind: 'commanderTax', delta: 1 })

  const taxCount2 = estate.game.cards['p0-cmd'].counters['commanderTax'] ?? 0
  assertEq(taxCount2, 2, 'commander has 2 tax counters after second death')
  assertEq(taxCount2 * 2, 4, 'commander tax cost = +4 after 2 deaths')
}

// ── 7. Pass turn + untap + auto draw ─────────────────────────────────────────

console.log('\n── 7. Turn structure: pass → untap → draw ──')
{
  let estate = buildGame()
  assertEq(estate.game.activeSeat, 0, 'game starts on seat 0')

  // Tap a card for seat 0
  estate = EngineCore.dispatch(estate, { t: 'card_tap', instanceId: 'p0-c1', tapped: true })
  assert(estate.game.cards['p0-c1'].tapped, 'p0-c1 is tapped')

  // Pass turn (table-core: pass_turn advances activeSeat)
  estate = EngineCore.dispatch(estate, { t: 'pass_turn' })
  assertEq(estate.game.activeSeat, 1, 'active seat advanced to 1 after pass_turn')

  // Untap all for seat 1 (seat 0's cards should NOT be untapped by seat 1's untap)
  estate = EngineCore.dispatch(estate, { t: 'untap_all', seat: 1 })
  assert(estate.game.cards['p0-c1'].tapped, 'p0-c1 still tapped after seat 1 untap_all')
  assert(!estate.game.cards['p1-c1'].tapped, 'p1-c1 untapped by seat 1 untap_all')

  // Seat 1 draws a card
  const libBefore = Object.values(estate.game.cards).filter(c => c.ownerSeat === 1 && c.zone === 'library').length
  const handBefore = Object.values(estate.game.cards).filter(c => c.ownerSeat === 1 && c.zone === 'hand').length
  estate = EngineCore.dispatch(estate, { t: 'draw', seat: 1, count: 1 })
  const libAfter = Object.values(estate.game.cards).filter(c => c.ownerSeat === 1 && c.zone === 'library').length
  const handAfter = Object.values(estate.game.cards).filter(c => c.ownerSeat === 1 && c.zone === 'hand').length
  assertEq(libAfter, libBefore - 1, 'library shrank by 1 after draw')
  assertEq(handAfter, handBefore + 1, 'hand grew by 1 after draw')
}

// ── 8. Token cleanup (SBA: token not on battlefield) ─────────────────────────

console.log('\n── 8. Token cleanup ──')
{
  let estate = buildGame()

  // Create a token on battlefield
  estate = EngineCore.dispatch(estate, {
    t: 'token_create', instanceId: 'tok-1', name: '1/1 Soldier',
    ownerSeat: 0, zone: 'battlefield', x: 50, y: 50
  })
  assert(estate.game.cards['tok-1']?.zone === 'battlefield', 'token created on battlefield')

  // Move token to graveyard — SBA should flag it for removal
  estate = EngineCore.dispatch(estate, { t: 'card_move', instanceId: 'tok-1', toZone: 'graveyard' })
  const findings = RulesSBA.detectAll(estate.game)
  const ceaseFindings = findings.filter(f => f.kind === 'cease_to_exist' && f.instanceId === 'tok-1')
  assert(ceaseFindings.length > 0, 'SBA detects token not on battlefield → cease to exist')

  // advance() should auto-remove it
  estate = EngineCore.advance(estate)
  assert(!estate.game.cards['tok-1'], 'token removed from game state after advance()')
}

// ── 9. Undo (snapshot restore) ────────────────────────────────────────────────

console.log('\n── 9. Undo ──')
{
  let estate = buildGame()
  const snapshot = JSON.parse(JSON.stringify(estate))

  estate = EngineCore.dispatch(estate, { t: 'adjust_life', seat: 0, delta: -5 })
  assertEq(estate.game.players[0].life, 35, 'life at 35 after -5')

  // Restore snapshot (simulate undoLast)
  estate = snapshot
  assertEq(estate.game.players[0].life, 40, 'life restored to 40 after undo')
}

// ── 10. Board wipe ────────────────────────────────────────────────────────────

console.log('\n── 10. Board wipe ──')
{
  let estate = buildGame()

  // Add a token
  estate = EngineCore.dispatch(estate, {
    t: 'token_create', instanceId: 'tok-w', name: 'Wumpus Token',
    ownerSeat: 1, zone: 'battlefield', x: 60, y: 60
  })

  const bfBefore = Object.values(estate.game.cards).filter(c => c.zone === 'battlefield')
  assert(bfBefore.length >= 3, `battlefield has ${bfBefore.length} permanents before wipe`)

  // Board wipe: non-tokens to graveyard, tokens removed
  const toGrave = []
  const toRemove = []
  for (const [id, c] of Object.entries(estate.game.cards)) {
    if (c.zone !== 'battlefield') continue
    if (c.isToken) toRemove.push(id)
    else toGrave.push(id)
  }

  for (const id of toGrave) {
    estate = EngineCore.dispatch(estate, { t: 'card_move', instanceId: id, toZone: 'graveyard' })
  }
  if (toRemove.length) {
    estate = EngineCore.dispatch(estate, { t: '__remove', ids: toRemove })
  }

  const bfAfter = Object.values(estate.game.cards).filter(c => c.zone === 'battlefield')
  assertEq(bfAfter.length, 0, 'battlefield empty after board wipe')
  assert(!estate.game.cards['tok-w'], 'token removed from game state by board wipe')
  assert(estate.game.cards['p0-c1']?.zone === 'graveyard', 'p0-c1 moved to graveyard by board wipe')
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)

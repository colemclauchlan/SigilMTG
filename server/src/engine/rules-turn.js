/*
 * rules-turn.js — Phase R5 (logic only) turn-structure engine. PURE.
 * Browser global (window.MTGRulesTurn) + Node module. Sequences the CR-500 turn through its
 * steps, performing the turn-based actions (untap, draw, mana emptying) and running engine-core's
 * priority routine (continuous effects -> SBAs -> triggers -> priority) at each step that grants
 * priority. It only drives engine-core via its public API + table-core primitives — no state reshape.
 *
 * This is the decision-INDEPENDENT half of "auto-drive": the turn sequence is identical whether the
 * engine ends up running client-side (single-player) or server-side (multiplayer authority — the
 * §10 decision). Wiring this to the live board, and the authority model, remain separate steps.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  if (root) root.MTGRulesTurn = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // CR 500 turn structure (the steps that carry turn-based actions and/or priority).
  var STEPS = [
    { name: "untap", phase: "beginning", untap: true, priority: false },
    { name: "upkeep", phase: "beginning", priority: true },
    { name: "draw", phase: "beginning", draw: true, priority: true },
    { name: "main1", phase: "precombat-main", priority: true },
    { name: "begin-combat", phase: "combat", priority: true },
    { name: "declare-attackers", phase: "combat", priority: true },
    { name: "declare-blockers", phase: "combat", priority: true },
    { name: "combat-damage", phase: "combat", priority: true },
    { name: "end-combat", phase: "combat", priority: true },
    { name: "main2", phase: "postcombat-main", priority: true },
    { name: "end", phase: "ending", priority: true },
    { name: "cleanup", phase: "ending", priority: false }
  ];

  function indexOfStep(name) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].name === name) return i; return -1; }

  // Mana pools empty as each step/phase ends (CR 500.4). Pool is modeled as player counters mana_<C>.
  function emptyMana(E, estate, seat) {
    var s = estate, p = s.game.players[seat];
    if (!p || !p.counters) return s;
    for (var k in p.counters) {
      if (k.indexOf("mana_") === 0 && p.counters[k]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: k, delta: -p.counters[k] });
    }
    return s;
  }

  // Perform a step: turn-based actions, set the phase, then (if the step grants priority) run the routine.
  function performStep(E, estate, step, opts) {
    opts = opts || {};
    var s = estate, seat = s.game.activeSeat;
    s = emptyMana(E, s, seat);
    if (step.untap) s = E.dispatch(s, { t: "untap_all", seat: seat });
    if (step.draw && !opts.skipDraw) s = E.dispatch(s, { t: "draw", seat: seat, count: 1 });
    s = E.dispatch(s, { t: "step_advance", phase: step.name });   // engine sets game.phase + priority=active
    if (step.priority) s = E.advance(s);                           // continuous -> SBAs -> triggers -> priority
    return s;
  }

  // Advance to the next step; at the end of the turn, pass to the next player and start their untap.
  function nextStep(E, estate, opts) {
    var idx = indexOfStep(estate.step); if (idx < 0) idx = 0;
    if (idx >= STEPS.length - 1) {
      var s = E.dispatch(estate, { t: "pass_turn" });
      return performStep(E, s, STEPS[0], { skipDraw: false });
    }
    return performStep(E, estate, STEPS[idx + 1], opts || {});
  }

  // Run the active player's whole turn (untap..cleanup), auto-passing priority (takes no game actions).
  function playTurn(E, estate, opts) {
    opts = opts || {};
    var s = performStep(E, estate, STEPS[0], { skipDraw: !!opts.skipFirstDraw });   // untap
    for (var i = 1; i < STEPS.length; i++) s = performStep(E, s, STEPS[i], {});
    return s;
  }

  return { STEPS: STEPS, indexOfStep: indexOfStep, emptyMana: emptyMana, performStep: performStep, nextStep: nextStep, playTurn: playTurn };
});

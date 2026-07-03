/*
 * engine-core.js — MTG rules-engine SPINE (Phase R0). PURE, deterministic, event-sourced.
 * Browser global (window.MTGEngine) + Node module. Composes table-core (MTGCore) for board
 * primitives and adds the CR-accurate orchestration shell: the stack, priority in APNAP order,
 * the hook points for state-based actions / triggered abilities / continuous effects, the
 * event log, and deterministic replay.
 *
 * R0 enforces NO card rules — the hook registries are empty by default. It locks in the loop
 * STRUCTURE (correct order per CR: continuous effects -> SBAs (repeat until stable) -> triggers
 * onto the stack in APNAP order -> grant priority) and the data shape, so later phases (R1+)
 * fill in behaviour without reshaping the spine. This module is standalone and is NOT wired
 * into the renderer, so manual tabletop play is unaffected.
 *
 * Determinism contract: applyEvent(estate, event) is a pure literal transition (no cascading,
 * no logging). Replaying the event log with applyEvent reproduces the exact state. The rule
 * registries are fixed configuration (card behaviours), not game state — replay is deterministic
 * given the same loaded ruleset, exactly like XMage replays are deterministic given the same cards.
 */
(function (root, factory) {
  var MTGCore = (typeof require !== "undefined") ? require("./table-core.js") : root.MTGCore;
  var mod = factory(MTGCore);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGEngine = mod;
})(typeof self !== "undefined" ? self : this, function (MTGCore) {
  "use strict";

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---- fixed ruleset registries (card behaviours register here; NOT part of game state) ----
  var RULES = { sba: [], triggers: [], continuous: [] };
  function registerSBA(fn) { RULES.sba.push(fn); return fn; }              // (game) -> [primitive events]
  function registerTrigger(w) { RULES.triggers.push(w); return w; }         // { collect(estate) -> [{id,controllerSeat,source,effects}] }
  function registerContinuous(fn) { RULES.continuous.push(fn); return fn; } // (game) -> game (layer application)
  function resetRules() { RULES.sba = []; RULES.triggers = []; RULES.continuous = []; }

  // ---- construction ----
  function create(opts) {
    opts = opts || {};
    var game = MTGCore.init(opts);
    return {
      game: game,                    // table-core board state — source of truth for the board
      stack: [],                     // LIFO: {id,controllerSeat,kind,source,effects,targets}
      priority: game.activeSeat,     // seat that currently holds priority
      passes: 0,                     // consecutive priority passes since the last stack change / step
      step: game.phase || "main1",
      seed: opts.seed || "engine",   // determinism anchor (randomness routes through MTGCore.shuffle)
      log: []                        // ordered applied events (the event-sourced spine)
    };
  }

  function isEngineEvent(t) {
    return t === "stack_push" || t === "stack_resolve" || t === "trigger_push" ||
           t === "priority_pass" || t === "grant_priority" || t === "step_advance";
  }
  function apnapOrder(estate) {                 // Active Player, Non-Active Players, in turn order
    var n = estate.game.seats, a = estate.game.activeSeat, out = [];
    for (var i = 0; i < n; i++) out.push((a + i) % n);
    return out;
  }
  function top(estate) { return estate.stack.length ? estate.stack[estate.stack.length - 1] : null; }

  // ---- the single PURE literal transition: (estate, event) -> estate'  (no cascade, no logging) ----
  function applyEvent(estate, event) {
    if (!event || !event.t) return estate;
    var s = clone(estate);
    if (isEngineEvent(event.t)) {
      switch (event.t) {
        case "stack_push":
          s.stack.push({
            id: event.id,
            controllerSeat: event.controllerSeat != null ? event.controllerSeat : s.game.activeSeat,
            kind: event.kind || "ability",
            source: event.source != null ? event.source : null,
            uncounterable: !!event.uncounterable,
            effects: event.effects ? clone(event.effects) : [],
            targets: event.targets ? clone(event.targets) : []
          });
          s.priority = event.controllerSeat != null ? event.controllerSeat : s.game.activeSeat;
          s.passes = 0;
          break;
        case "trigger_push":
          s.stack.push({
            id: event.id, controllerSeat: event.controllerSeat, kind: "triggered",
            source: event.source != null ? event.source : null,
            effects: event.effects ? clone(event.effects) : [], targets: []
          });
          break;
        case "stack_resolve": {
          var obj = s.stack.pop();
          if (obj) (obj.effects || []).forEach(function (eff) {
            // engine-level effect: counter (remove) a target object still on the stack (CR 701.5)
            if (eff && eff.t === "counter_target") {
              for (var i = s.stack.length - 1; i >= 0; i--) {
                if (s.stack[i].id === eff.target) {
                  var rem = s.stack.splice(i, 1)[0];
                  // the countered spell's card goes to its owner's graveyard (CR 701.5a)
                  if (rem && rem.source != null && s.game.cards[rem.source]) s.game = MTGCore.reduce(s.game, { t: "card_move", instanceId: rem.source, toZone: "graveyard" });
                  break;
                }
              }
            } else { s.game = MTGCore.reduce(s.game, eff); }  // board primitive -> table-core (unchanged path)
          });
          s.priority = s.game.activeSeat; s.passes = 0;
          break;
        }
        case "priority_pass":
          s.passes += 1;
          if (s.passes < s.game.seats) s.priority = (s.priority + 1) % s.game.seats;
          break;
        case "grant_priority":
          s.priority = event.seat != null ? event.seat : s.game.activeSeat; s.passes = 0;
          break;
        case "step_advance":
          if (event.phase != null) { s.game = MTGCore.reduce(s.game, { t: "set_phase", phase: event.phase }); s.step = event.phase; }
          s.priority = s.game.activeSeat; s.passes = 0;
          break;
      }
    } else {
      s.game = MTGCore.reduce(s.game, event);  // board primitive -> compose table-core
    }
    return s;
  }

  // ---- dispatch = applyEvent + record to the log (use this when driving the game) ----
  function dispatch(estate, event) {
    var s = applyEvent(estate, event);
    s.log.push(clone(event));
    return s;
  }

  // ---- the "whenever a player would receive priority" routine (CR order). R0 hooks are empty. ----
  function advance(estate) {
    var s = clone(estate);
    // 1. continuous effects (layer system) — R0: none registered
    RULES.continuous.forEach(function (fn) { s.game = fn(s.game) || s.game; });
    // 2. state-based actions — check all, perform simultaneously, repeat until stable (CR 704)
    var guard = 0;
    while (guard++ < 1000) {
      var evs = [];
      RULES.sba.forEach(function (fn) { var r = fn(s.game); if (r && r.length) evs = evs.concat(r); });
      if (!evs.length) break;
      evs.forEach(function (ev) { s = dispatch(s, ev); });
    }
    // 3. put waiting triggered abilities on the stack in APNAP order (CR 603)
    var pending = [];
    RULES.triggers.forEach(function (w) { if (w.collect) { var t = w.collect(s); if (t && t.length) pending = pending.concat(t); } });
    apnapOrder(s).forEach(function (seat) {
      pending.filter(function (t) { return t.controllerSeat === seat; })
             .forEach(function (t) { s = dispatch(s, { t: "trigger_push", id: t.id, controllerSeat: t.controllerSeat, source: t.source, effects: t.effects }); });
    });
    // 4. grant priority to the active player
    s = dispatch(s, { t: "grant_priority", seat: s.game.activeSeat });
    return s;
  }

  // ---- convenience: a player passes priority; resolve top or advance the step when all have passed ----
  function passPriority(estate) {
    var s = dispatch(estate, { t: "priority_pass" });
    if (s.passes >= s.game.seats) {
      if (s.stack.length) { s = dispatch(s, { t: "stack_resolve" }); s = advance(s); }
      else { s = dispatch(s, { t: "step_advance" }); s = advance(s); }
    }
    return s;
  }

  // ---- deterministic replay: fold the literal log over a fresh game (no cascade) ----
  function replay(events, opts) {
    var s = create(opts);
    (events || []).forEach(function (ev) { s = applyEvent(s, ev); });
    return s;
  }

  return {
    create: create, applyEvent: applyEvent, dispatch: dispatch,
    advance: advance, passPriority: passPriority, replay: replay,
    top: top, apnapOrder: apnapOrder,
    registerSBA: registerSBA, registerTrigger: registerTrigger, registerContinuous: registerContinuous, resetRules: resetRules,
    RULES: RULES
  };
});

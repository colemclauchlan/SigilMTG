/*
 * rules-triggers.js — Phase R4 triggered-ability event layer. PURE.
 * Browser global (window.MTGRulesTriggers) + Node module. Recognizes game EVENTS and — given a
 * card lookup + definition lookup — produces the trigger objects to push onto the stack. Nothing
 * is mutated; the caller dispatches the returned triggers through engine-core (trigger_push).
 *
 * Two recognizers:
 *   - diffEvents(prevGame, nextGame): zone-transition events (etb / dies / exiled / token created)
 *     by comparing two board states. This is the reliable path, because a resolving spell's effects
 *     are applied inside the stack resolution and aren't individually logged.
 *   - gameEventsFromLog(log, fromIndex): events that ARE explicit log entries (cast, draw).
 *
 * collectTriggers() turns either event list into stack-ready triggers. This is what makes real
 * triggered abilities fire (e.g. an ETB "draw a card"): the engine spine already has the trigger
 * hook + stack; this layer is the event recognition + binding that feeds it.
 *
 * Card-definition trigger shape:
 *   def.triggers = [ { on: "etb"|"dies"|"exiled"|"cast"|"draw", effects: [ <table-core primitive,
 *                      with seat:"controller"|"owner" allowed> ] } ]
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  if (root) root.MTGRulesTriggers = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Zone-transition events from comparing two board states (reliable for resolution effects).
  function diffEvents(prevGame, nextGame) {
    var out = [];
    var pc = (prevGame && prevGame.cards) || {}, nc = (nextGame && nextGame.cards) || {};
    for (var id in nc) {
      var p = pc[id], n = nc[id];
      var pz = p ? p.zone : null, nz = n.zone;
      if (pz === nz) continue;
      if (nz === "battlefield") out.push({ kind: "etb", instanceId: id, newCard: !p });
      else if (nz === "graveyard") out.push({ kind: "dies", instanceId: id });
      else if (nz === "exile") out.push({ kind: "exiled", instanceId: id });
    }
    return out;
  }

  // Events that appear as explicit log entries (cast, draw).
  function gameEventsFromLog(log, fromIndex) {
    var out = [];
    for (var i = (fromIndex || 0); i < (log || []).length; i++) {
      var e = log[i];
      if (!e || !e.t) continue;
      if (e.t === "draw") out.push({ kind: "draw", seat: e.seat });
      else if (e.t === "stack_push" && e.kind === "spell") out.push({ kind: "cast", instanceId: e.id, controllerSeat: e.controllerSeat });
    }
    return out;
  }

  // Bind effect templates to the source card (resolve seat:"controller"/"owner").
  function bindEffects(effects, card) {
    return (effects || []).map(function (e) {
      var o = {}; for (var k in e) o[k] = e[k];
      if (o.seat === "controller") o.seat = card.controllerSeat;
      else if (o.seat === "owner") o.seat = card.ownerSeat;
      return o;
    });
  }

  // Match events to card triggers. ctx = { getCard(instanceId)->card, getDef(name)->def }.
  function collectTriggers(events, ctx) {
    var out = [];
    (events || []).forEach(function (ev) {
      if (ev.instanceId == null) return;
      var card = ctx.getCard(ev.instanceId); if (!card) return;
      var def = ctx.getDef(card.name != null ? card.name : card.cardId); if (!def || !def.triggers) return;
      def.triggers.forEach(function (t, i) {
        if (t.on !== ev.kind) return;
        out.push({
          id: "trg-" + ev.instanceId + "-" + ev.kind + "-" + i,
          controllerSeat: card.controllerSeat,
          source: ev.instanceId,
          effects: bindEffects(t.effects, card)
        });
      });
    });
    return out;
  }

  return { diffEvents: diffEvents, gameEventsFromLog: gameEventsFromLog, collectTriggers: collectTriggers, bindEffects: bindEffects };
});

/*
 * rules-connive.js — connive N (CR 702.148). PURE.
 * Browser global (window.MTGRulesConnive) + Node module. "Connive N" means: draw N cards, then discard
 * N cards. For each NONLAND card discarded this way, put a +1/+1 counter on the conniving creature.
 * (Connive with no number = connive 1.) This module resolves the discard step deterministically given
 * which of the drawn/held cards the controller chooses to pitch: it emits the discard moves and the
 * exact counter delta (count of nonland discards). Drawing itself is left to the driver (it's a plain
 * `draw` event); connive's rules-specific twist is the nonland-counting, which lives here.
 *
 *   conniveN(game, id, ctx)                          -> N (>=1) if the creature connives, else 0
 *   nonlandCount(discardNames, ctx)                  -> how many of the discarded cards are nonland
 *   resolveEvents(game, id, discardIds, ctx)         -> [draw, card_move→graveyard x, card_counter]
 *                                                       (drawN defaults to discardIds.length)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesConnive = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function defOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    return (c && Cards && Cards.get(c.name)) || null;
  }

  function conniveN(game, id, ctx) {
    var def = defOf(game, id, ctx);
    if (!def) return 0;
    if (def.connive != null) { var n = def.connive | 0; return n > 0 ? n : 1; }
    return (def.abilities || []).indexOf("connive") >= 0 ? 1 : 0;
  }

  function hasConnive(game, id, ctx) { return conniveN(game, id, ctx) > 0; }

  function isLandName(name, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), def = Cards && Cards.get(name);
    return !!(def && (def.types || []).indexOf("land") >= 0);
  }

  // count how many of the discarded card NAMES are nonland (each grants one +1/+1 counter)
  function nonlandCount(discardNames, ctx) {
    var n = 0;
    (discardNames || []).forEach(function (nm) { if (!isLandName(nm, ctx)) n++; });
    return n;
  }

  // resolve connive: draw N, discard the chosen cards to the graveyard, then add one +1/+1 counter
  // per NONLAND discarded. discardIds are the instance ids the controller chose to pitch.
  function resolveEvents(game, id, discardIds, ctx) {
    var c = game.cards[id]; if (!c) return [];
    if (!hasConnive(game, id, ctx)) return [];
    discardIds = discardIds || [];
    var seat = c.controllerSeat, events = [{ t: "draw", seat: seat, count: discardIds.length }];
    var nonland = 0;
    discardIds.forEach(function (did) {
      var dc = game.cards[did]; if (!dc) return;
      events.push({ t: "card_move", instanceId: did, toZone: "graveyard" });
      if (!isLandName(dc.name, ctx)) nonland++;
    });
    if (nonland > 0) events.push({ t: "card_counter", instanceId: id, kind: "+1/+1", delta: nonland });
    return events;
  }

  return { conniveN: conniveN, hasConnive: hasConnive, nonlandCount: nonlandCount, resolveEvents: resolveEvents };
});

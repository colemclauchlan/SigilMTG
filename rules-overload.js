/*
 * rules-overload.js — overload (CR 702.96). PURE.
 * Browser global (window.MTGRulesOverload) + Node module. "You may cast this spell for its overload cost.
 * If you do, change its text by replacing all instances of 'target' with 'each'." A spell cast for its
 * overload cost affects everything it could target instead of a single target (e.g. Cyclonic Rift). This
 * module gives the overload cost, the payability check, the cast events, and an `overloaded` flag the
 * resolver reads to switch single-target text to "each".
 *
 *   def.overload = { generic:6, U:1 }     // the alternative overload cost
 *
 *   overloadCost(def)                          -> the overload cost, or null
 *   canOverload(game, cardId, seat, ctx)       -> { ok, reason }   (in hand, yours, can pay overload)
 *   overloadEvents(game, cardId, ctx)          -> [pay…, hand→stack, __set overloaded]
 *   isOverloaded(game, cardId)                 -> bool
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesOverload = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }

  function overloadCost(def) { return (def && def.overload) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canOverload(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "you cast the spell from your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var cost = overloadCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no overload" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the overload cost" };
    return { ok: true };
  }

  // cast the spell overloaded: pay the overload cost, move hand -> stack, flag it so it hits "each"
  function overloadEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var cost = overloadCost(Cards && Cards.get(c.name)); if (!cost) return [];
    var events = payEvents(game, owner(c), cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { overloaded: true } }] });
    return events;
  }

  function isOverloaded(game, cardId) {
    var c = game.cards[cardId];
    return !!(c && c.overloaded);
  }

  return { overloadCost: overloadCost, canOverload: canOverload, overloadEvents: overloadEvents, isOverloaded: isOverloaded };
});

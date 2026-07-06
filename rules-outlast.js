/*
 * rules-outlast.js — outlast (CR 702.85). PURE.
 * Browser global (window.MTGRulesOutlast) + Node module. "Outlast [cost] means '[cost], {T}: Put a +1/+1
 * counter on this creature. Activate this ability only as a sorcery.'" This module owns the cost, the check
 * (your untapped creature, cost payable) and the events (pay, tap, add a +1/+1 counter).
 *
 *   def.outlast = { W:1 }     // the activation cost (in addition to tapping)
 *
 *   outlastCost(def)                          -> the outlast cost, or null
 *   canOutlast(game, cardId, seat, ctx)       -> { ok, reason }  (your untapped creature, payable)
 *   outlastEvents(game, cardId, ctx)          -> [pay…, tap, +1 +1/+1 counter]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesOutlast = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function outlastCost(def) { return (def && def.outlast) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canOutlast(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "battlefield") return { ok: false, reason: "the creature must be on the battlefield" };
    if (owner(c) !== seat) return { ok: false, reason: "not your creature" };
    if (!isCreature(Cards && Cards.get(c.name))) return { ok: false, reason: "not a creature" };
    if (c.tapped) return { ok: false, reason: "it's already tapped" };
    var cost = outlastCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no outlast" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the outlast cost" };
    return { ok: true };
  }

  // pay the cost, tap the creature, put a +1/+1 counter on it
  function outlastEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var cost = outlastCost(Cards && Cards.get(c.name)); if (!cost) return [];
    var events = payEvents(game, owner(c), cost, ctx);
    events.push({ t: "card_tap", instanceId: cardId, tapped: true });
    events.push({ t: "card_counter", instanceId: cardId, kind: "+1/+1", delta: 1 });
    return events;
  }

  return { outlastCost: outlastCost, canOutlast: canOutlast, outlastEvents: outlastEvents };
});

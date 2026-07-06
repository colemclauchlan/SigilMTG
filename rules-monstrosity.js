/*
 * rules-monstrosity.js — monstrosity (CR 701.31). PURE.
 * Browser global (window.MTGRulesMonstrosity) + Node module. "Monstrosity N: if this permanent isn't
 * monstrous, put N +1/+1 counters on it and it becomes monstrous." An activated ability that only works
 * once. This module owns the cost + N, the eligibility check (creature you control, not already monstrous,
 * cost payable) and the events (pay, add N counters, flag monstrous).
 *
 *   def.monstrosity = { n:3, cost:{ generic:5 } }
 *
 *   monstrosityInfo(def)                          -> { n, cost } or null
 *   canMonstrosity(game, cardId, seat, ctx)       -> { ok, reason }
 *   monstrosityEvents(game, cardId, ctx)          -> [pay…, +N +1/+1 counters, __set monstrous]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMonstrosity = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }

  function monstrosityInfo(def) { return (def && def.monstrosity) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canMonstrosity(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "battlefield") return { ok: false, reason: "the permanent must be on the battlefield" };
    if (owner(c) !== seat) return { ok: false, reason: "not your permanent" };
    if (c.monstrous) return { ok: false, reason: "it is already monstrous" };
    var info = monstrosityInfo(Cards && Cards.get(c.name));
    if (!info) return { ok: false, reason: "no monstrosity" };
    if (Mana && info.cost && !Mana.canPay(info.cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the monstrosity cost" };
    return { ok: true };
  }

  // pay the cost, add N +1/+1 counters, and mark it monstrous (so it can't be used again)
  function monstrosityEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var info = monstrosityInfo(Cards && Cards.get(c.name)); if (!info) return [];
    var events = payEvents(game, owner(c), info.cost, ctx);
    events.push({ t: "card_counter", instanceId: cardId, kind: "+1/+1", delta: info.n || 0 });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { monstrous: true } }] });
    return events;
  }

  return { monstrosityInfo: monstrosityInfo, canMonstrosity: canMonstrosity, monstrosityEvents: monstrosityEvents };
});

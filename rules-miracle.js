/*
 * rules-miracle.js — miracle (CR 702.94). PURE.
 * Browser global (window.MTGRulesMiracle) + Node module. "You may cast this card for its miracle cost when
 * you draw it if it's the first card you've drawn this turn." This module owns the miracle cost, the
 * eligibility check (in hand, has miracle, it was the first draw this turn, cost payable) and the cast
 * events. Whether a card was the first draw this turn is board bookkeeping the caller supplies.
 *
 *   def.miracle = { R:1 }     // the (usually cheap) miracle cost; def.mana is the normal cost
 *
 *   miracleCost(def)                                    -> the miracle cost, or null
 *   canMiracle(game, cardId, seat, firstDrawThisTurn, ctx) -> { ok, reason }
 *   castMiracleEvents(game, cardId, ctx)                -> [pay miracle…, hand→stack]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMiracle = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }

  function miracleCost(def) { return (def && def.miracle) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canMiracle(game, cardId, seat, firstDrawThisTurn, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "the drawn card is in your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var cost = miracleCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no miracle" };
    if (!firstDrawThisTurn) return { ok: false, reason: "not the first card drawn this turn" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the miracle cost" };
    return { ok: true };
  }

  // cast for the miracle cost: pay it, move hand -> stack
  function castMiracleEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var cost = miracleCost(Cards && Cards.get(c.name)); if (!cost) return [];
    var events = payEvents(game, owner(c), cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { castViaMiracle: true } }] });
    return events;
  }

  return { miracleCost: miracleCost, canMiracle: canMiracle, castMiracleEvents: castMiracleEvents };
});

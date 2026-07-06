/*
 * rules-buyback.js — buyback (CR 702.27). PURE.
 * Browser global (window.MTGRulesBuyback) + Node module. "You may pay an additional [buyback cost] as you
 * cast this spell. If the buyback cost was paid, put this card into its owner's hand as it resolves instead
 * of into the graveyard." A recurring spell. This module owns the buyback cost, the payability check, the
 * cast events (base cast + the extra cost + a flag), and the resolve-to-hand replacement.
 *
 *   def.buyback = { generic:3 }     // the additional buyback cost
 *
 *   buybackCost(def)                             -> the buyback cost, or null
 *   canBuyback(game, cardId, seat, ctx)          -> { ok, reason }   (in hand, yours, can pay buyback)
 *   castWithBuybackEvents(game, cardId, ctx)     -> [pay buyback…, hand→stack, __set boughtBack]
 *   resolveBuybackEvents(game, cardId)           -> [stack→hand]  (instead of the graveyard) or []
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesBuyback = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }

  function buybackCost(def) { return (def && def.buyback) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canBuyback(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "you cast the spell from your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var cost = buybackCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no buyback" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the buyback cost" };
    return { ok: true };
  }

  // cast paying the extra buyback cost, and flag the spell so it returns to hand on resolution
  function castWithBuybackEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var cost = buybackCost(Cards && Cards.get(c.name)); if (!cost) return [];
    var events = payEvents(game, owner(c), cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { boughtBack: true } }] });
    return events;
  }

  // on resolution: a bought-back spell goes to its owner's hand instead of the graveyard
  function resolveBuybackEvents(game, cardId) {
    var c = game.cards[cardId];
    if (!c || !c.boughtBack) return [];
    return [
      { t: "card_move", instanceId: cardId, toZone: "hand" },
      { t: "__set", cards: [{ id: cardId, fields: { boughtBack: false } }] }
    ];
  }

  return { buybackCost: buybackCost, canBuyback: canBuyback, castWithBuybackEvents: castWithBuybackEvents, resolveBuybackEvents: resolveBuybackEvents };
});

/*
 * rules-spectacle.js — spectacle (CR 702.108). PURE.
 * Browser global (window.MTGRulesSpectacle) + Node module. "You may cast this spell for its spectacle cost
 * rather than its mana cost if an opponent lost life this turn." Whether an opponent lost life this turn is
 * board bookkeeping the caller supplies (opts.opponentLostLife) — this module owns the cost, the eligibility
 * check, and the cast events, flagging the spell so the board knows it was cast via spectacle.
 *
 *   def.spectacle = { generic:1, R:1 }     // the alternative spectacle cost
 *
 *   spectacleCost(def)                                       -> the spectacle cost, or null
 *   canCastSpectacle(game, cardId, seat, oppLostLife, ctx)   -> { ok, reason }
 *   castSpectacleEvents(game, cardId, ctx)                   -> [pay…, hand→stack, __set castViaSpectacle]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSpectacle = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }

  function spectacleCost(def) { return (def && def.spectacle) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  // eligible if the card is in your hand, has a spectacle cost, an opponent lost life this turn, and you can pay
  function canCastSpectacle(game, cardId, seat, oppLostLife, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "you cast the spell from your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var cost = spectacleCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no spectacle" };
    if (!oppLostLife) return { ok: false, reason: "no opponent lost life this turn" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the spectacle cost" };
    return { ok: true };
  }

  // cast for the spectacle cost: pay it, move hand -> stack, flag the spell
  function castSpectacleEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var cost = spectacleCost(Cards && Cards.get(c.name)); if (!cost) return [];
    var events = payEvents(game, owner(c), cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { castViaSpectacle: true } }] });
    return events;
  }

  return { spectacleCost: spectacleCost, canCastSpectacle: canCastSpectacle, castSpectacleEvents: castSpectacleEvents };
});

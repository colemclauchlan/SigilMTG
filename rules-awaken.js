/*
 * rules-awaken.js — awaken (CR 702.113). PURE.
 * Browser global (window.MTGRulesAwaken) + Node module. "You may cast this spell for its awaken cost. If you
 * do, also put N +1/+1 counters on target land you control, and it becomes a 0/0 Elemental creature with
 * haste that's still a land." This module owns the awaken cost + N, the check, and the cast + land-animation
 * events.
 *
 *   def.awaken = { cost:{ generic:5, U:1 }, n:3 }
 *
 *   awakenInfo(def)                                    -> { cost, n } or null
 *   canAwaken(game, cardId, seat, landId, ctx)         -> { ok, reason }
 *   castAwakenEvents(game, cardId, landId, ctx)        -> [pay…, spell→stack, +N on land, __set awakened]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAwaken = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isLand(def) { return !!(def && def.types && def.types.indexOf("land") >= 0); }

  function awakenInfo(def) { return (def && def.awaken) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canAwaken(game, cardId, seat, landId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "cast from your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var info = awakenInfo(Cards && Cards.get(c.name));
    if (!info) return { ok: false, reason: "no awaken" };
    var land = game.cards[landId];
    if (!land || land.zone !== "battlefield" || owner(land) !== seat || !isLand(Cards && Cards.get(land.name))) return { ok: false, reason: "target a land you control" };
    if (Mana && info.cost && !Mana.canPay(info.cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the awaken cost" };
    return { ok: true };
  }

  // cast for the awaken cost + animate the target land (N counters, becomes a 0/0 creature)
  function castAwakenEvents(game, cardId, landId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var info = awakenInfo(Cards && Cards.get(c.name)); if (!info) return [];
    var events = payEvents(game, owner(c), info.cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { awakened: true } }] });
    if (game.cards[landId]) {
      if (info.n > 0) events.push({ t: "card_counter", instanceId: landId, kind: "+1/+1", delta: info.n });
      events.push({ t: "__set", cards: [{ id: landId, fields: { animatedLand: true } }] });
    }
    return events;
  }

  return { awakenInfo: awakenInfo, canAwaken: canAwaken, castAwakenEvents: castAwakenEvents };
});

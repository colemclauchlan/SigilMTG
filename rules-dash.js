/*
 * rules-dash.js — dash (CR 702.109). PURE.
 * Browser global (window.MTGRulesDash) + Node module. "You may cast this card for its dash cost. If you do,
 * it gains haste, and it's returned to its owner's hand at the beginning of the next end step." Composes the
 * mana + zone systems as replayable events: pay the DASH cost, put the creature onto the battlefield from the
 * hand with a `dashed` flag and granted haste; then at the next end step every dashed creature bounces home.
 *
 *   def.dash = { generic:1, R:1 }          // the alternative (dash) cost
 *
 *   dashCost(def)                          -> the cost, or null
 *   canDash(game, cardId, seat, ctx)       -> { ok, reason }
 *   castDash(game, cardId, seat, ctx)      -> [pay dash cost, move hand → battlefield, mark dashed + haste]
 *   dashReturns(game, ctx)                 -> [card_move → hand, clear dashed/haste] for each dashed creature
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDash = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function dashCost(def) { return (def && def.dash) || null; }

  // emit player_counter deltas that pay `cost` out of the seat's mana pool (same shape as flashback/cycling)
  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canDash(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "card is not in your hand" };
    if (c.ownerSeat !== seat) return { ok: false, reason: "not your card" };
    var def = Cards && Cards.get(c.name), cost = dashCost(def);
    if (!cost) return { ok: false, reason: "no dash" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the dash cost" };
    return { ok: true };
  }

  function castDash(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId], def = Cards && Cards.get(c.name), cost = dashCost(def);
    var events = payEvents(game, seat, cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "battlefield" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { dashed: true, dashHaste: true } }] });   // haste until it leaves
    return events;
  }

  // at the beginning of the next end step, every dashed creature on the battlefield is returned to its owner's hand
  function dashReturns(game, ctx) {
    var events = [];
    var ids = Object.keys(game.cards || {});
    for (var i = 0; i < ids.length; i++) {
      var c = game.cards[ids[i]];
      if (c && c.dashed && c.zone === "battlefield") {
        events.push({ t: "card_move", instanceId: c.instanceId, toZone: "hand" });
        events.push({ t: "__set", cards: [{ id: c.instanceId, fields: { dashed: false, dashHaste: false } }] });
      }
    }
    return events;
  }

  return { dashCost: dashCost, canDash: canDash, castDash: castDash, dashReturns: dashReturns };
});

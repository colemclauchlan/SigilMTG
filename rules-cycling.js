/*
 * rules-cycling.js — cycling (CR 702.29). PURE.
 * Browser global (window.MTGRulesCycling) + Node module. "Cycling [cost] — [cost], Discard this card:
 * Draw a card." An activated ability you use from your hand. Composes the mana + zone systems as
 * replayable events.
 *
 *   def.cycling = { generic:2 }            // the cycling cost
 *
 *   cyclingCost(def)                       -> the cost, or null
 *   canCycle(game, cardId, seat, ctx)      -> { ok, reason }
 *   cycleEvents(game, cardId, ctx)         -> [pay cost, discard (hand→graveyard), draw 1]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesCycling = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function cyclingCost(def) { return (def && def.cycling) || null; }

  function canCycle(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "card is not in your hand" };
    if (c.ownerSeat !== seat) return { ok: false, reason: "not your card" };
    var cost = cyclingCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no cycling" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the cycling cost" };
    return { ok: true };
  }

  function cycleEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId], seat = c.ownerSeat, cost = cyclingCost(Cards && Cards.get(c.name)), events = [];
    if (cost && Mana) {
      var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
      Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
      Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    }
    events.push({ t: "card_move", instanceId: cardId, toZone: "graveyard" });   // discard
    events.push({ t: "draw", seat: seat, count: 1 });                            // draw a card
    return events;
  }

  return { cyclingCost: cyclingCost, canCycle: canCycle, cycleEvents: cycleEvents };
});

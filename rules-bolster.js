/*
 * rules-bolster.js — bolster (CR 701.30). PURE.
 * Browser global (window.MTGRulesBolster) + Node module. "Bolster N: choose a creature with the least
 * toughness among creatures you control, then put N +1/+1 counters on it." This module finds the
 * least-toughness creatures you control (the legal choices) and emits the counter event.
 *
 *   effToughness(game, cardId, ctx)             -> base toughness + (+1/+1) − (−1/−1) counters
 *   leastToughness(game, seat, ctx)             -> [instanceId…]  (your creatures tied for least toughness)
 *   canBolster(game, creatureId, seat, ctx)     -> { ok, reason }  (chosen creature is among the least)
 *   bolsterEvents(game, creatureId, n, ctx)     -> [card_counter +N +1/+1]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesBolster = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function effToughness(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return Infinity;
    var def = Cards && Cards.get(c.name);
    if (!def || def.toughness == null) return Infinity;
    var ctr = c.counters || {};
    return def.toughness + (ctr["+1/+1"] || 0) - (ctr["-1/-1"] || 0);
  }

  function yourCreatures(game, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), out = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (!c || c.zone !== "battlefield" || owner(c) !== seat) continue;
      if (isCreature(Cards && Cards.get(c.name))) out.push(id);
    }
    return out;
  }

  function leastToughness(game, seat, ctx) {
    var mine = yourCreatures(game, seat, ctx);
    if (!mine.length) return [];
    var min = Infinity;
    mine.forEach(function (id) { var t = effToughness(game, id, ctx); if (t < min) min = t; });
    return mine.filter(function (id) { return effToughness(game, id, ctx) === min; });
  }

  function canBolster(game, creatureId, seat, ctx) {
    var mine = yourCreatures(game, seat, ctx);
    if (!mine.length) return { ok: false, reason: "you control no creatures" };
    if (leastToughness(game, seat, ctx).indexOf(creatureId) < 0) return { ok: false, reason: "choose a creature with the least toughness" };
    return { ok: true };
  }

  function bolsterEvents(game, creatureId, n, ctx) {
    if (!game.cards[creatureId] || !n) return [];
    return [{ t: "card_counter", instanceId: creatureId, kind: "+1/+1", delta: n }];
  }

  return { effToughness: effToughness, leastToughness: leastToughness, canBolster: canBolster, bolsterEvents: bolsterEvents };
});

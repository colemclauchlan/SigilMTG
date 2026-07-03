/*
 * rules-convoke.js — convoke (CR 702.51). PURE.
 * Browser global (window.MTGRulesConvoke) + Node module. "Your creatures can help cast this spell. Each
 * creature you tap while casting it pays for {1} or one mana of that creature's color." This computes the
 * cost AFTER convoking a chosen set of creatures, and the resulting tap events; the rest is paid from the
 * mana pool (rules-mana). Pays a matching colored pip first (generic is flexible), so it covers the most.
 *
 *   convokeCreatures(game, seat, ctx)         -> [{ id, colors:[…] }]  untapped creatures available to convoke
 *   convokeReduce(cost, creatureColorsList)    -> reduced cost  (each entry = that creature's colors)
 *   castWithConvoke(cost, game, seat, tapIds, ctx) -> { remaining, tapEvents, payableFromPool }
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesConvoke = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

  function convokeCreatures(game, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), out = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.zone !== "battlefield" || c.controllerSeat !== seat || c.tapped) continue;
      var def = Cards && Cards.get(c.name);
      if (def && def.types.indexOf("creature") >= 0) out.push({ id: id, colors: (def.colors || []).slice() });
    }
    return out;
  }

  // reduce a mana cost by convoking creatures (each pays a matching colored pip if owed, else {1})
  function convokeReduce(cost, creatureColorsList) {
    var c = clone(cost);
    (creatureColorsList || []).forEach(function (colors) {
      var paid = false;
      for (var i = 0; i < (colors || []).length; i++) { var k = colors[i]; if (c[k] > 0) { c[k]--; paid = true; break; } }
      if (!paid && c.generic > 0) c.generic--;   // otherwise pay {1}; if nothing's owed, this creature is wasted
    });
    return c;
  }

  // tap the chosen creatures, get the leftover cost + whether the pool can cover it
  function castWithConvoke(cost, game, seat, tapIds, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), byId = {};
    convokeCreatures(game, seat, ctx).forEach(function (cr) { byId[cr.id] = cr.colors; });
    var colorsList = (tapIds || []).filter(function (id) { return byId[id]; }).map(function (id) { return byId[id]; });
    var remaining = convokeReduce(cost, colorsList);
    var tapEvents = (tapIds || []).filter(function (id) { return byId[id]; }).map(function (id) { return { t: "card_tap", instanceId: id, tapped: true }; });
    var payable = Mana ? Mana.canPay(remaining, Mana.poolFromCounters(game.players[seat].counters)) : null;
    return { remaining: remaining, tapEvents: tapEvents, payableFromPool: payable };
  }

  return { convokeCreatures: convokeCreatures, convokeReduce: convokeReduce, castWithConvoke: castWithConvoke };
});

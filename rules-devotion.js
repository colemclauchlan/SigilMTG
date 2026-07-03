/*
 * rules-devotion.js — devotion (CR 700.5). PURE.
 * Browser global (window.MTGRulesDevotion) + Node module. "Your devotion to [color] is the number of mana
 * symbols of that color among the mana costs of permanents you control" (Gray Merchant, Nykthos, several
 * commanders). A read-only count over card-defs mana costs on the battlefield.
 *
 *   devotion(game, seat, colors, ctx) -> number   colors = "B" | ["B","G"] (two-color devotion sums both)
 *   devotionByColor(game, seat, ctx)  -> { W,U,B,R,G }
 *
 * (Hybrid pips — which count for either color — aren't modeled in the WUBRGC cost shape; documented.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDevotion = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function devotion(game, seat, colors, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var want = (typeof colors === "string") ? [colors] : (colors || []);
    var total = 0;
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.zone !== "battlefield" || c.controllerSeat !== seat) continue;
      var def = Cards && Cards.get(c.name);
      if (!def || !def.mana) continue;
      for (var i = 0; i < want.length; i++) total += def.mana[want[i]] || 0;
    }
    return total;
  }

  function devotionByColor(game, seat, ctx) {
    return { W: devotion(game, seat, "W", ctx), U: devotion(game, seat, "U", ctx), B: devotion(game, seat, "B", ctx), R: devotion(game, seat, "R", ctx), G: devotion(game, seat, "G", ctx) };
  }

  return { devotion: devotion, devotionByColor: devotionByColor };
});

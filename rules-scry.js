/*
 * rules-scry.js — scry / look-at-top-of-library (CR 701.18). PURE (drives engine-core).
 * Browser global (window.MTGRulesScry) + Node module. topCards() returns the top N library cards (what
 * the player looks at); scry() sends the chosen cards to the BOTTOM of the library and keeps the rest on
 * top in order; autoScry() is a simple deterministic policy (bottom excess lands when flooded). Built on
 * table-core's library reorder, so it stays replay-safe. (Surveil = a graveyard variant, deferred.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesScry = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function topCards(game, seat, count, ctx) {
    var Core = pick(ctx, "Core", "MTGCore");
    return Core.cardsOf(game, seat, "library").slice(0, count || 1);
  }

  // move bottomIds to the bottom of the library; everything else keeps its relative order on top
  function scry(E, estate, seat, bottomIds, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), lib = Core.cardsOf(estate.game, seat, "library");
    var bottom = {}; (bottomIds || []).forEach(function (id) { bottom[id] = true; });
    var kept = lib.filter(function (c) { return !bottom[c.instanceId]; }).map(function (c) { return c.instanceId; });
    var binned = lib.filter(function (c) { return bottom[c.instanceId]; }).map(function (c) { return c.instanceId; });
    return E.dispatch(estate, { t: "library_scry", order: kept.concat(binned) });
  }

  // simple AI: among the top `count`, bottom lands beyond what the player needs (4+ lands in play = flooded)
  function autoScry(estate, seat, count, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), Cards = pick(ctx, "Cards", "MTGCards");
    var landsInPlay = Core.cardsOf(estate.game, seat, "battlefield").filter(function (c) { var d = Cards && Cards.get(c.name); return d && d.types.indexOf("land") >= 0; }).length;
    var flooded = landsInPlay >= 4;
    var out = [];
    topCards(estate.game, seat, count, ctx).forEach(function (c) {
      var d = Cards && Cards.get(c.name);
      var isLand = d && d.types.indexOf("land") >= 0;
      if (flooded && isLand) out.push(c.instanceId);          // bottom excess lands when flooded
      else if (!flooded && !isLand && d && d.power == null && !d.spell && !d.produces) out.push(c.instanceId); // bottom blanks when we need action
    });
    return out;
  }

  return { topCards: topCards, scry: scry, autoScry: autoScry };
});

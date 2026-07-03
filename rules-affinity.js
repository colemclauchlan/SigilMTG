/*
 * rules-affinity.js — affinity (CR 702.41). PURE.
 * Browser global (window.MTGRulesAffinity) + Node module. "Affinity for artifacts" reduces a spell's
 * GENERIC cost by {1} for each permanent of the named kind (default "artifact") its controller controls.
 * This is a cost reduction: it only touches the generic component — colored/colorless pips keep their
 * requirement and the generic can never go below {0}. Nothing is mutated; the reduced cost object is
 * returned for rules-mana to pay from the pool.
 *
 *   cost = { W,U,B,R,G,C, generic }
 *   affinityCount(game, seat, kind, ctx)  -> number of `kind` permanents `seat` controls (kind defaults "artifact")
 *   reducedCost(cost, n)                  -> new cost with generic clamped at max(0, generic - n)
 *
 * (Affinity for a specific subtype/color, or "for Equipment you control", is the same shape with a
 * different kind/predicate and is deferred.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAffinity = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function clone(o) { var n = {}; for (var k in (o || {})) n[k] = o[k]; return n; }

  // does this card's definition include the given type (e.g. "artifact")?
  function defHasType(def, kind) {
    return !!def && (def.types || []).indexOf(kind) >= 0;
  }

  // count permanents of `kind` (a card type, default "artifact") that `seat` controls on the battlefield
  function affinityCount(game, seat, kind, ctx) {
    kind = kind || "artifact";
    var Cards = pick(ctx, "Cards", "MTGCards"), n = 0;
    var cards = (game && game.cards) || {};
    for (var id in cards) {
      var c = cards[id];
      if (!c || c.zone !== "battlefield" || c.controllerSeat !== seat) continue;
      var def = Cards && Cards.get(c.name);
      if (defHasType(def, kind)) n++;
    }
    return n;
  }

  // reduce ONLY the generic part of a cost by n, clamped at 0; colored/colorless pips are untouched
  function reducedCost(cost, n) {
    var c = clone(cost);
    var gen = c.generic || 0;
    c.generic = Math.max(0, gen - (n || 0));
    return c;
  }

  return { affinityCount: affinityCount, reducedCost: reducedCost, defHasType: defHasType };
});

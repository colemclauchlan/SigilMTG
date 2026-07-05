/*
 * rules-discover.js — discover N (CR 702.171). PURE.
 * Browser global (window.MTGRulesDiscover) + Node module. "Discover N" exiles cards from the top of your
 * library until you exile a NONLAND card with mana value N or LESS. You may cast that card without paying
 * its mana cost, or put it into your hand. Then put the rest of the exiled cards on the bottom of your
 * library in a random order. Closely related to cascade, but the threshold is a fixed N (mana value <= N,
 * inclusive) rather than the cast spell's mana value, and the hit may go to hand instead of the stack.
 *
 *   manaValue(def)                         -> number (sum of the mana cost)
 *   discover(game, seat, n, ctx)           -> { exiled:[id…], hit:id|null }   (reveal until a nonland MV<=n)
 *   bottomEvents(exiled, hit)              -> events to bottom the non-hit cards
 *   castFreeEvents(hitId)                  -> events to move the hit to the stack (cast without paying)
 *   toHandEvents(hitId)                    -> events to put the hit into hand instead
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDiscover = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function manaValue(def) {
    if (!def || !def.mana) return 0;
    var m = def.mana, total = 0;
    for (var k in m) total += m[k] || 0;
    return total;
  }

  // exile from the top of the library until a nonland card with mana value <= n
  function discover(game, seat, n, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Core = pick(ctx, "Core", "MTGCore");
    var lib = Core ? Core.cardsOf(game, seat, "library") : [], exiled = [], hit = null;
    for (var i = 0; i < lib.length; i++) {
      var c = lib[i], def = Cards && Cards.get(c.name);
      exiled.push(c.instanceId);
      var isLand = def && def.types && def.types.indexOf("land") >= 0;
      if (def && !isLand && manaValue(def) <= n) { hit = c.instanceId; break; }
    }
    return { exiled: exiled, hit: hit };
  }

  // put the exiled non-hit cards on the bottom of the library
  function bottomEvents(exiled, hit) {
    return (exiled || []).filter(function (id) { return id !== hit; }).map(function (id) { return { t: "card_move", instanceId: id, toZone: "library", bottom: true }; });
  }

  // cast the hit for free: put it on the stack (the caller resolves it like any spell)
  function castFreeEvents(hitId) {
    return hitId ? [{ t: "card_move", instanceId: hitId, toZone: "stack" }] : [];
  }

  // or, decline to cast: put the hit into the player's hand
  function toHandEvents(hitId) {
    return hitId ? [{ t: "card_move", instanceId: hitId, toZone: "hand" }] : [];
  }

  return { manaValue: manaValue, discover: discover, bottomEvents: bottomEvents, castFreeEvents: castFreeEvents, toHandEvents: toHandEvents };
});

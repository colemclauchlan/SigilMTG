/*
 * rules-cascade.js — cascade (CR 702.85). PURE.
 * Browser global (window.MTGRulesCascade) + Node module. When you cast a spell with cascade, exile cards
 * from the top of your library until you exile a nonland card whose mana value is LESS than the cascading
 * spell's; you may cast that card for free; then put the other exiled cards on the bottom in a random
 * order. This computes the reveal (the exiled run + the hit) and the follow-up events.
 *
 *   manaValue(def)                              -> number (sum of the mana cost)
 *   cascade(game, seat, spellMV, ctx)           -> { exiled:[id…], hit:id|null }
 *   bottomEvents(exiled, hit)                    -> events to put the non-hit cards on the bottom (kept order)
 *   castFreeEvents(hitId)                        -> events to move the hit to the stack (cast without paying)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesCascade = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function manaValue(def) {
    if (!def || !def.mana) return 0;
    var m = def.mana, total = 0;
    for (var k in m) total += m[k] || 0;
    return total;
  }

  function cascade(game, seat, spellMV, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Core = pick(ctx, "Core", "MTGCore");
    var lib = Core ? Core.cardsOf(game, seat, "library") : [], exiled = [], hit = null;
    for (var i = 0; i < lib.length; i++) {
      var c = lib[i], def = Cards && Cards.get(c.name);
      exiled.push(c.instanceId);
      var isLand = def && def.types.indexOf("land") >= 0;
      if (def && !isLand && manaValue(def) < spellMV) { hit = c.instanceId; break; }
    }
    return { exiled: exiled, hit: hit };
  }

  // put the exiled non-hit cards on the bottom of the library (kept in their revealed order)
  function bottomEvents(exiled, hit) {
    return (exiled || []).filter(function (id) { return id !== hit; }).map(function (id) { return { t: "card_move", instanceId: id, toZone: "library", bottom: true }; });
  }

  // cast the hit for free: put it on the stack (the caller resolves it like any spell)
  function castFreeEvents(hitId) {
    return hitId ? [{ t: "card_move", instanceId: hitId, toZone: "stack" }] : [];
  }

  return { manaValue: manaValue, cascade: cascade, bottomEvents: bottomEvents, castFreeEvents: castFreeEvents };
});

/*
 * rules-transform.js — transforming double-faced permanents (CR 701.28 / 712). PURE.
 * Browser global (window.MTGRulesTransform) + Node module. A transforming DFC has a front and a back face
 * with their OWN characteristics (P/T, types, colors, abilities). This selects the active face and returns
 * its effective characteristics, and toggles the face via table-core's `card_transform` (which flips the
 * `flipped` flag). Feed `currentFace()` into rules-layers/printedBase to compose with counters/anthems.
 *
 *   def.back = { name, types, subtypes?, colors?, power?, toughness?, abilities? }   // the other face
 *
 *   isTransformed(game, id)            -> is the back face up?
 *   currentFace(game, id, ctx)          -> the active face's definition (front or back)
 *   effectiveFace(game, id, ctx)        -> { name, power, toughness, types, colors, abilities } of the active face
 *   transformEvents(id)                 -> [card_transform] (flip to the other face)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesTransform = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function isTransformed(game, id) { var c = game.cards[id]; return !!(c && c.flipped); }

  function currentFace(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id]; if (!c) return null;
    var def = Cards && Cards.get(c.name); if (!def) return null;
    return (c.flipped && def.back) ? def.back : def;
  }

  function effectiveFace(game, id, ctx) {
    var f = currentFace(game, id, ctx); if (!f) return null;
    return { name: f.name, power: f.power, toughness: f.toughness, types: (f.types || []).slice(), colors: (f.colors || []).slice(), abilities: (f.abilities || []).slice() };
  }

  function transformEvents(id) { return [{ t: "card_transform", instanceId: id }]; }

  return { isTransformed: isTransformed, currentFace: currentFace, effectiveFace: effectiveFace, transformEvents: transformEvents };
});

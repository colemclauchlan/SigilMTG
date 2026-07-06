/*
 * rules-improvise.js — improvise (CR 702.126). PURE.
 * Browser global (window.MTGRulesImprovise) + Node module. "Improvise: each artifact you tap after you're
 * done activating mana abilities pays for {1}." Like convoke, but with artifacts paying generic mana. This
 * module lists your untapped artifacts, validates a chosen set, and emits the taps + the generic reduction.
 *
 *   def.improvise = true
 *
 *   hasImprovise(def)                                  -> bool
 *   untappedArtifacts(game, seat, ctx)                 -> [instanceId…]
 *   canImprovise(game, cardId, seat, tapIds, ctx)      -> { ok, reason }
 *   improviseReduction(tapIds)                          -> number of generic mana covered
 *   improviseEvents(game, tapIds, ctx)                  -> [card_tap each]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesImprovise = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isArtifact(def) { return !!(def && def.types && def.types.indexOf("artifact") >= 0); }

  function hasImprovise(def) { return !!(def && def.improvise); }

  function untappedArtifacts(game, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), out = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (!c || c.zone !== "battlefield" || owner(c) !== seat || c.tapped) continue;
      if (isArtifact(Cards && Cards.get(c.name))) out.push(id);
    }
    return out;
  }

  function canImprovise(game, cardId, seat, tapIds, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    if (!hasImprovise(Cards && Cards.get((game.cards[cardId] || {}).name))) return { ok: false, reason: "no improvise" };
    tapIds = tapIds || [];
    for (var i = 0; i < tapIds.length; i++) {
      var a = game.cards[tapIds[i]];
      if (!a || a.zone !== "battlefield" || owner(a) !== seat || a.tapped || !isArtifact(Cards && Cards.get(a.name))) return { ok: false, reason: "tap only your untapped artifacts" };
      if (tapIds.indexOf(tapIds[i]) !== i) return { ok: false, reason: "each artifact can be tapped only once" };
    }
    return { ok: true };
  }

  function improviseReduction(tapIds) { return (tapIds || []).length; }

  function improviseEvents(game, tapIds, ctx) {
    return (tapIds || []).filter(function (id) { return game.cards[id]; }).map(function (id) {
      return { t: "card_tap", instanceId: id, tapped: true };
    });
  }

  return { hasImprovise: hasImprovise, untappedArtifacts: untappedArtifacts, canImprovise: canImprovise, improviseReduction: improviseReduction, improviseEvents: improviseEvents };
});

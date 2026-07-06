/*
 * rules-explore.js — explore (CR 701.40). PURE.
 * Browser global (window.MTGRulesExplore) + Node module. "When a creature explores, reveal the top card of
 * your library. If it's a land, put it into your hand. Otherwise put a +1/+1 counter on the creature, then
 * you may put the revealed card into your graveyard or leave it on top." This module reveals the top card,
 * returns the outcome (land → hand, else → +1/+1 counter), and a helper for the nonland graveyard choice.
 *
 *   topOfLibrary(game, seat, ctx)               -> instanceId of the top library card, or null
 *   explore(game, creatureId, seat, ctx)        -> { revealed, isLand, events }
 *   sendRevealedToGraveyard(revealedId)         -> [card_move revealed→graveyard]  (optional, nonland only)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesExplore = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function isLand(def) { return !!(def && def.types && def.types.indexOf("land") >= 0); }

  function topOfLibrary(game, seat, ctx) {
    var Core = pick(ctx, "Core", "MTGCore");
    var lib = Core ? Core.cardsOf(game, seat, "library") : [];
    return lib.length ? lib[0].instanceId : null;
  }

  function explore(game, creatureId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var topId = topOfLibrary(game, seat, ctx);
    if (!topId) return { revealed: null, isLand: false, events: [] };
    var top = game.cards[topId], land = isLand(Cards && Cards.get(top.name));
    if (land) return { revealed: topId, isLand: true, events: [{ t: "card_move", instanceId: topId, toZone: "hand" }] };
    return { revealed: topId, isLand: false, events: [{ t: "card_counter", instanceId: creatureId, kind: "+1/+1", delta: 1 }] };
  }

  // nonland reveal: the controller may put it into the graveyard instead of leaving it on top
  function sendRevealedToGraveyard(revealedId) {
    return revealedId ? [{ t: "card_move", instanceId: revealedId, toZone: "graveyard" }] : [];
  }

  return { topOfLibrary: topOfLibrary, explore: explore, sendRevealedToGraveyard: sendRevealedToGraveyard };
});

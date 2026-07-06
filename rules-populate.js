/*
 * rules-populate.js — populate (CR 701.29). PURE.
 * Browser global (window.MTGRulesPopulate) + Node module. "To populate, choose a creature token you control,
 * then create a token that's a copy of it." This module lists your creature tokens and emits a token_create
 * that copies the chosen token's printed characteristics (name/kind), controlled by you.
 *
 *   creatureTokens(game, seat, ctx)              -> [instanceId…]  (creature tokens you control)
 *   canPopulate(game, tokenId, seat, ctx)        -> { ok, reason }
 *   populateEvents(game, tokenId, newId, ctx)    -> [token_create copy]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesPopulate = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function creatureTokens(game, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), out = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (!c || !c.isToken || c.zone !== "battlefield" || owner(c) !== seat) continue;
      if (isCreature(Cards && Cards.get(c.name))) out.push(id);
    }
    return out;
  }

  function canPopulate(game, tokenId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[tokenId];
    if (!c || !c.isToken || c.zone !== "battlefield") return { ok: false, reason: "choose a token on the battlefield" };
    if (owner(c) !== seat) return { ok: false, reason: "not your token" };
    if (!isCreature(Cards && Cards.get(c.name))) return { ok: false, reason: "the token must be a creature" };
    return { ok: true };
  }

  // create a token that's a copy of the chosen creature token (same printed characteristics)
  function populateEvents(game, tokenId, newId, ctx) {
    var src = game.cards[tokenId];
    if (!src || !src.isToken) return [];
    return [{ t: "token_create", instanceId: newId, name: src.name, cardId: src.cardId != null ? src.cardId : null, ownerSeat: owner(src) }];
  }

  return { creatureTokens: creatureTokens, canPopulate: canPopulate, populateEvents: populateEvents };
});

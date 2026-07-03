/*
 * rules-graveyard.js — graveyard recursion / reanimation (CR 608 effects that move cards from a graveyard).
 * Browser global (window.MTGRulesGraveyard) + Node module. PURE. The backbone of "return target creature
 * card from your graveyard to your hand" (Raise Dead) and "...to the battlefield" (Reanimate / Animate
 * Dead). Reads a graveyard against a filter and returns replayable move events.
 *
 *   graveyardCards(game, seat, filter, ctx) -> [instanceId…]   filter = { name?, type?, subtype?, supertype? }
 *   recur(game, cardId, toZone?, opts?)      -> [card_move → toZone (default hand) (+card_tap if opts.tapped)]
 *   reanimate(game, cardId, opts?)           -> recur(... "battlefield" ...)  (reanimation shorthand)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesGraveyard = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function matches(def, name, f) {
    if (!f) return true;
    if (f.name && name !== f.name) return false;
    if (!def) return !(f.type || f.subtype || f.supertype);
    if (f.type && def.types.indexOf(f.type) < 0) return false;
    if (f.subtype && (def.subtypes || []).indexOf(f.subtype) < 0) return false;
    if (f.supertype && (def.supertypes || []).indexOf(f.supertype) < 0) return false;
    return true;
  }

  function graveyardCards(game, seat, filter, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Core = pick(ctx, "Core", "MTGCore"), out = [];
    var gy = Core ? Core.cardsOf(game, seat, "graveyard") : [];
    gy.forEach(function (c) { if (matches(Cards && Cards.get(c.name), c.name, filter)) out.push(c.instanceId); });
    return out;
  }

  function recur(game, cardId, toZone, opts) {
    opts = opts || {}; var events = [{ t: "card_move", instanceId: cardId, toZone: toZone || "hand" }];
    if (opts.tapped) events.push({ t: "card_tap", instanceId: cardId, tapped: true });
    return events;
  }

  function reanimate(game, cardId, opts) { return recur(game, cardId, "battlefield", opts); }

  return { graveyardCards: graveyardCards, recur: recur, reanimate: reanimate };
});

/*
 * rules-retrace.js — retrace (CR 702.82). PURE.
 * Browser global (window.MTGRulesRetrace) + Node module. "You may cast this card from your graveyard by
 * discarding a land card in addition to paying its other costs." A recursion mechanic. This module owns the
 * eligibility check (card is in your graveyard, has retrace, and you have a land in hand to discard) and the
 * events (discard the chosen land, move the card from graveyard to the stack).
 *
 *   def.retrace = true
 *
 *   hasRetrace(def)                                   -> bool
 *   landsInHand(game, seat, ctx)                       -> [instanceId…]   (land cards you could discard)
 *   canRetrace(game, cardId, seat, ctx)                -> { ok, reason }
 *   retraceEvents(game, cardId, landId, ctx)           -> [discard land (hand→graveyard), card graveyard→stack]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesRetrace = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isLand(def) { return !!(def && def.types && def.types.indexOf("land") >= 0); }

  function hasRetrace(def) { return !!(def && def.retrace); }

  function landsInHand(game, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), out = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (!c || c.zone !== "hand" || owner(c) !== seat) continue;
      if (isLand(Cards && Cards.get(c.name))) out.push(id);
    }
    return out;
  }

  function canRetrace(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId];
    if (!c || c.zone !== "graveyard") return { ok: false, reason: "you retrace a card from your graveyard" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    if (!hasRetrace(Cards && Cards.get(c.name))) return { ok: false, reason: "no retrace" };
    if (!landsInHand(game, seat, ctx).length) return { ok: false, reason: "no land in hand to discard" };
    return { ok: true };
  }

  // discard the chosen land, then move the retraced card from the graveyard to the stack
  function retraceEvents(game, cardId, landId, ctx) {
    var c = game.cards[cardId], land = game.cards[landId];
    if (!c || !land) return [];
    return [
      { t: "card_move", instanceId: landId, toZone: "graveyard" },
      { t: "card_move", instanceId: cardId, toZone: "stack" }
    ];
  }

  return { hasRetrace: hasRetrace, landsInHand: landsInHand, canRetrace: canRetrace, retraceEvents: retraceEvents };
});

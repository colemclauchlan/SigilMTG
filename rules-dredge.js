/*
 * rules-dredge.js — dredge (CR 702.52). PURE.
 * Browser global (window.MTGRulesDredge) + Node module. "If you would draw a card while this card is in your
 * graveyard, you may instead mill N cards and return this card from your graveyard to your hand." It's a
 * replacement for the draw. You can only dredge if your library has at least N cards. Composes the mill +
 * zone systems as replayable events.
 *
 *   def.dredge = 3                          // dredge N (mill this many)
 *
 *   dredgeN(def)                            -> N, or 0
 *   canDredge(game, seat, cardId, ctx)      -> true only if the card is a dredge card in this seat's graveyard
 *                                              and the library has >= N cards
 *   dredge(game, seat, cardId, ctx)         -> [mill N, return card → hand]  (the replacement for a draw)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDredge = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function dredgeN(def) { return (def && def.dredge) || 0; }

  function canDredge(game, seat, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Core = pick(ctx, "Core", "MTGCore");
    var c = game.cards[cardId];
    if (!c || c.zone !== "graveyard" || c.ownerSeat !== seat) return false;
    var n = dredgeN(Cards && Cards.get(c.name));
    if (!n) return false;
    var libCount = Core ? Core.zoneCount(game, seat, "library") : 0;
    return libCount >= n;   // need at least N cards to mill
  }

  function dredge(game, seat, cardId, ctx) {
    if (!canDredge(game, seat, cardId, ctx)) return [];
    var Cards = pick(ctx, "Cards", "MTGCards");
    var n = dredgeN(Cards && Cards.get(game.cards[cardId].name));
    return [
      { t: "mill", seat: seat, count: n },
      { t: "card_move", instanceId: cardId, toZone: "hand" }
    ];
  }

  return { dredgeN: dredgeN, canDredge: canDredge, dredge: dredge };
});

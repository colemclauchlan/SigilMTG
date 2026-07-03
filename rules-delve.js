/*
 * rules-delve.js — delve (CR 702.66). PURE.
 * Browser global (window.MTGRulesDelve) + Node module. "Each card you exile from your graveyard while
 * casting this spell pays for {1}." Delve is an alternative way to pay the GENERIC cost only: each
 * exiled graveyard card removes {1} of generic (never below {0}); colored/colorless pips are untouched.
 * Nothing is mutated — the reduced cost + the exile events are returned for the caller to apply.
 *
 *   cost = { W,U,B,R,G,C, generic }
 *   maxDelve(game, seat, ctx)                       -> how many cards `seat` could delve (graveyard size)
 *   delvePay(game, seat, cost, exileIds, ctx)       -> { cost: reducedCost, events: [exile…] }
 *     only graveyard cards owned/controlled by `seat` are eligible; only as many as remain useful
 *     against the generic cost are exiled (extra ids are ignored, matching "no reason to delve more").
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDelve = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function clone(o) { var n = {}; for (var k in (o || {})) n[k] = o[k]; return n; }

  function inGraveyardOf(game, id, seat) {
    var c = game && game.cards && game.cards[id];
    if (!c || c.zone !== "graveyard") return false;
    var owner = c.controllerSeat != null ? c.controllerSeat : c.ownerSeat;
    return owner === seat;
  }

  // how many cards seat has in its graveyard (the upper bound on delve)
  function maxDelve(game, seat, ctx) {
    var n = 0, cards = (game && game.cards) || {};
    for (var id in cards) { if (inGraveyardOf(game, id, seat)) n++; }
    return n;
  }

  // exile chosen graveyard cards to pay generic; reduces generic only, never below 0
  function delvePay(game, seat, cost, exileIds, ctx) {
    var c = clone(cost);
    var gen = c.generic || 0;
    var events = [];
    var ids = exileIds || [];
    for (var i = 0; i < ids.length && gen > 0; i++) {
      var id = ids[i];
      if (!inGraveyardOf(game, id, seat)) continue;     // only your own graveyard cards are eligible
      gen -= 1;
      events.push({ t: "card_move", instanceId: id, toZone: "exile" });
    }
    c.generic = gen;
    return { cost: c, events: events };
  }

  return { maxDelve: maxDelve, delvePay: delvePay };
});

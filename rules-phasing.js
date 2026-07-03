/*
 * rules-phasing.js — phasing (CR 702.26). PURE.
 * Browser global (window.MTGRulesPhasing) + Node module. A phased-out permanent is treated as though it
 * doesn't exist (can't be targeted, doesn't block/attack, its abilities don't apply). It phases back in
 * during its controller's untap step. Built on table-core's `card_phase` (toggles the `phased` flag).
 *
 *   phaseEvents(id)               -> [card_phase]   (toggle phased in/out)
 *   isPhasedOut(game, id)         -> boolean
 *   existsForRules(game, id)      -> false while phased out (a helper for queries to honor phasing)
 *   phaseInAll(game, seat)        -> [card_phase …] to phase the seat's phased-out permanents back in (untap)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesPhasing = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function isPhasedOut(game, id) { var c = game.cards[id]; return !!(c && c.phased); }
  function phaseEvents(id) { return [{ t: "card_phase", instanceId: id }]; }
  function existsForRules(game, id) { var c = game.cards[id]; return !!c && !c.phased; }

  // at the controller's untap, all their phased-out permanents phase back in
  function phaseInAll(game, seat) {
    var out = [];
    for (var id in game.cards) { var c = game.cards[id]; if (c.controllerSeat === seat && c.phased) out.push({ t: "card_phase", instanceId: id }); }
    return out;
  }

  return { isPhasedOut: isPhasedOut, phaseEvents: phaseEvents, existsForRules: existsForRules, phaseInAll: phaseInAll };
});

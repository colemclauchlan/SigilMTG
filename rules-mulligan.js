/*
 * rules-mulligan.js — the London mulligan (CR 103.5). PURE.
 * Browser global (window.MTGRulesMulligan) + Node module. Each mulligan: shuffle your hand into your
 * library and draw seven. When you finally KEEP after M mulligans, put M cards from your hand on the
 * bottom of your library. Composes the shuffle + draw + library systems as replayable events.
 *
 *   mulliganEvents(game, seat, ctx)            -> [hand → library, shuffle, draw 7]
 *   keepEvents(game, seat, bottomIds, ctx)      -> [move the chosen cards to the bottom of the library]
 *   handSize(game, seat)                        -> current hand size
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMulligan = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function handSize(game, seat, ctx) { var Core = pick(ctx, "Core", "MTGCore"); return Core ? Core.cardsOf(game, seat, "hand").length : 0; }

  // one mulligan: shuffle the whole hand back, then draw a fresh seven
  function mulliganEvents(game, seat, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), hand = Core ? Core.cardsOf(game, seat, "hand") : [], events = [];
    hand.forEach(function (c) { events.push({ t: "card_move", instanceId: c.instanceId, toZone: "library" }); });
    events.push({ t: "library_shuffle", seat: seat });
    events.push({ t: "draw", seat: seat, count: 7 });
    return events;
  }

  // keep after M mulligans: put M chosen cards from hand on the bottom of the library
  function keepEvents(game, seat, bottomIds, ctx) {
    return (bottomIds || []).map(function (id) { return { t: "card_move", instanceId: id, toZone: "library", bottom: true }; });
  }

  return { mulliganEvents: mulliganEvents, keepEvents: keepEvents, handSize: handSize };
});

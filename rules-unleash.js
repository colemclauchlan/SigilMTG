/*
 * rules-unleash.js — unleash (CR 702.86). PURE.
 * Browser global (window.MTGRulesUnleash) + Node module. "You may have this permanent enter with a +1/+1
 * counter on it. It can't block as long as it has a +1/+1 counter." A choose-at-entry tradeoff. This module
 * owns the enter choice and the can't-block restriction while a +1/+1 counter is present.
 *
 *   def.unleash = true
 *
 *   hasUnleash(def)                              -> bool
 *   unleashEnterEvents(game, cardId, withCounter, ctx) -> [card_counter +1/+1] or []
 *   canBlock(game, cardId, ctx)                  -> bool  (false while an unleashed creature has a +1/+1 counter)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesUnleash = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function hasUnleash(def) { return !!(def && def.unleash); }

  // choose at entry whether to enter with a +1/+1 counter
  function unleashEnterEvents(game, cardId, withCounter, ctx) {
    if (!game.cards[cardId] || !withCounter) return [];
    return [{ t: "card_counter", instanceId: cardId, kind: "+1/+1", delta: 1 }];
  }

  // an unleashed creature can't block while it has a +1/+1 counter
  function canBlock(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return false;
    if (!hasUnleash(Cards && Cards.get(c.name))) return true;
    var plus = (c.counters && c.counters["+1/+1"]) || 0;
    return plus <= 0;
  }

  return { hasUnleash: hasUnleash, unleashEnterEvents: unleashEnterEvents, canBlock: canBlock };
});

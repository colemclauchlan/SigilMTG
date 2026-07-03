/*
 * rules-suspend.js — suspend (CR 702.62). PURE.
 * Browser global (window.MTGRulesSuspend) + Node module. "Rather than cast this card from your hand, you
 * may pay its suspend cost and exile it with N time counters. At the start of each of your upkeeps, remove
 * a time counter; when the last is removed, cast it without paying its mana cost (it has haste until it
 * leaves play)." Composes the counter + exile systems as replayable events.
 *
 *   def.suspend = { n:3, cost:{ R:1 } }    // time counters + the suspend cost
 *
 *   suspend(game, cardId, n)        -> [exile the card, put N time counters, mark suspended]
 *   tick(game, cardId)              -> [remove one time counter] (start of your upkeep)
 *   timeCounters(game, cardId)      -> remaining time counters
 *   readyToCast(game, cardId)       -> suspended with 0 time counters left
 *   castEvents(game, cardId)        -> [move exile → stack, grant haste] (cast without paying mana)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSuspend = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function timeCounters(game, cardId) { var c = game.cards[cardId]; return (c && c.counters && c.counters.time) || 0; }

  function suspend(game, cardId, n) {
    return [
      { t: "card_move", instanceId: cardId, toZone: "exile" },
      { t: "card_counter", instanceId: cardId, kind: "time", delta: n || 0 },
      { t: "__set", cards: [{ id: cardId, fields: { suspended: true } }] }
    ];
  }

  function tick(game, cardId) {
    return timeCounters(game, cardId) > 0 ? [{ t: "card_counter", instanceId: cardId, kind: "time", delta: -1 }] : [];
  }

  function readyToCast(game, cardId) {
    var c = game.cards[cardId]; return !!(c && c.suspended && timeCounters(game, cardId) === 0);
  }

  function castEvents(game, cardId) {
    if (!readyToCast(game, cardId)) return [];
    return [
      { t: "card_move", instanceId: cardId, toZone: "stack" },
      { t: "__set", cards: [{ id: cardId, fields: { suspendHaste: true } }] }   // haste until it leaves play
    ];
  }

  return { timeCounters: timeCounters, suspend: suspend, tick: tick, readyToCast: readyToCast, castEvents: castEvents };
});

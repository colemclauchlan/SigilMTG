/*
 * rules-proliferate.js — proliferate (CR 701.27). PURE.
 * Browser global (window.MTGRulesProliferate) + Node module. "Choose any number of permanents and/or
 * players that have a counter, then give each another counter of each kind already there." Composes the
 * whole counter system — +1/+1, −1/−1, loyalty, poison, energy, charge, … — as replayable events.
 *
 * IMPORTANT: this engine stores some non-counter bookkeeping in `counters` (marked combat `damage`, the
 * `regen` shield, the `sick` summoning-sickness marker) and the mana pool as player `mana_*` counters —
 * none of those are real counters, so proliferate explicitly skips them.
 *
 *   proliferateTargets(game)         -> { cards:[id…], players:[seat…] }  (those with a real counter)
 *   proliferateEvents(game, choices) -> [events]   choices = { cards:[id…], players:[seat…] }
 *   proliferateAll(game)             -> events for every eligible permanent + player (the common choice)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesProliferate = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var SKIP_CARD = { damage: true, regen: true, sick: true };          // not real counters
  function realCardKinds(counters) { return Object.keys(counters || {}).filter(function (k) { return !SKIP_CARD[k] && counters[k] > 0; }); }
  function realPlayerKinds(counters) { return Object.keys(counters || {}).filter(function (k) { return k.indexOf("mana_") !== 0 && counters[k] > 0; }); }

  function proliferateTargets(game) {
    var cards = [], players = [];
    for (var id in game.cards) { var c = game.cards[id]; if (c.zone === "battlefield" && realCardKinds(c.counters).length) cards.push(id); }
    for (var s = 0; s < game.seats; s++) { if (game.players[s] && realPlayerKinds(game.players[s].counters).length) players.push(s); }
    return { cards: cards, players: players };
  }

  function proliferateEvents(game, choices) {
    choices = choices || {}; var events = [];
    (choices.cards || []).forEach(function (id) {
      var c = game.cards[id]; if (!c) return;
      realCardKinds(c.counters).forEach(function (k) { events.push({ t: "card_counter", instanceId: id, kind: k, delta: 1 }); });
    });
    (choices.players || []).forEach(function (seat) {
      var p = game.players[seat]; if (!p) return;
      realPlayerKinds(p.counters).forEach(function (k) { events.push({ t: "player_counter", seat: seat, kind: k, delta: 1 }); });
    });
    return events;
  }

  function proliferateAll(game) { return proliferateEvents(game, proliferateTargets(game)); }

  return { proliferateTargets: proliferateTargets, proliferateEvents: proliferateEvents, proliferateAll: proliferateAll };
});

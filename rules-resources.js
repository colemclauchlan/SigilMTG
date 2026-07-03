/*
 * rules-resources.js — player resource counters: energy (CR 720) & experience (CR 122.1). PURE.
 * Browser global (window.MTGRulesResources) + Node module. A small, honest utility for the player-owned
 * "resource" counters that several mechanics/commanders track — gain them, spend them (with a legality
 * check), and read thresholds. Energy {E} is spent as a cost; experience counters only accrue and are
 * read by abilities. (Poison is read by rules-sba; included here only for the gain/read helpers.)
 *
 *   get(game, seat, kind)            -> current count        kind = "energy" | "experience" | "poison" | …
 *   gain(seat, kind, n)              -> [player_counter +n]
 *   canPay(game, seat, kind, n)      -> boolean
 *   pay(seat, kind, n)               -> [player_counter -n]   (caller checks canPay first)
 *   pool(game, seat)                 -> { energy, experience, poison }
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesResources = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function get(game, seat, kind) { var p = game.players[seat]; return (p && p.counters && p.counters[kind]) || 0; }
  function gain(seat, kind, n) { return n ? [{ t: "player_counter", seat: seat, kind: kind, delta: n }] : []; }
  function canPay(game, seat, kind, n) { return get(game, seat, kind) >= (n || 0); }
  function pay(seat, kind, n) { return n ? [{ t: "player_counter", seat: seat, kind: kind, delta: -n }] : []; }
  function pool(game, seat) { return { energy: get(game, seat, "energy"), experience: get(game, seat, "experience"), poison: get(game, seat, "poison") }; }

  return { get: get, gain: gain, canPay: canPay, pay: pay, pool: pool };
});

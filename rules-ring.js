/*
 * rules-ring.js — "the Ring tempts you" & the Ring-bearer (CR 701.52). PURE.
 * Browser global (window.MTGRulesRing) + Node module. Each time the Ring tempts you, you choose a creature
 * you control to become your Ring-bearer and the Ring gains its next level of temptation (max 4); the
 * Ring-bearer has all the abilities the Ring has gained so far. Tracked per player on
 * players[seat].ringLevel / players[seat].ringBearer (table-core __set), so it's replay-safe.
 *
 *   tempt(game, seat, bearerId)     -> [set the Ring-bearer + advance the level (cap 4)]
 *   ringLevel(game, seat) / ringBearer(game, seat)
 *   abilitiesAt(level)              -> the cumulative Ring abilities at that level
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesRing = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  // the four levels of the Ring's temptation (CR 701.52), as descriptive ability tokens
  var RING = [
    "ring-bearer is legendary and can't be blocked by creatures with greater power",
    "whenever the Ring-bearer attacks, tap target creature defending player controls",
    "whenever the Ring-bearer deals combat damage to a player, that player discards a card",
    "whenever the Ring-bearer dies or is put into exile, draw a card"
  ];

  function ringLevel(game, seat) { var p = game.players[seat]; return (p && p.ringLevel) || 0; }
  function ringBearer(game, seat) { var p = game.players[seat]; return (p && p.ringBearer) || null; }
  function abilitiesAt(level) { return RING.slice(0, Math.max(0, Math.min(level || 0, RING.length))); }

  function tempt(game, seat, bearerId) {
    var next = Math.min(ringLevel(game, seat) + 1, RING.length);
    var fields = { ringLevel: next };
    if (bearerId != null) fields.ringBearer = bearerId;
    return [{ t: "__set", players: [{ seat: seat, fields: fields }] }];
  }

  return { RING: RING, ringLevel: ringLevel, ringBearer: ringBearer, abilitiesAt: abilitiesAt, tempt: tempt };
});

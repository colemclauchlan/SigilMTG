/*
 * rules-monarch.js — the Monarch (an "ongoing designation", as on Palace Jailer / Court of …). PURE.
 * Browser global (window.MTGRulesMonarch) + Node module. Commander-flavored: exactly one player is the
 * monarch; the monarch draws a card at the beginning of THEIR end step; and whenever a creature deals
 * combat damage to the monarch, that creature's controller becomes the monarch. Tracked as a
 * `isMonarch` flag on players (table-core `__set` players branch), so it's replay-safe.
 *
 *   setMonarch(game, seat)                       -> events to make `seat` the monarch (clears the old one)
 *   monarch(game)                                -> the current monarch's seat, or null
 *   endStepDraw(game, seat)                       -> [draw] if `seat` is the monarch (their end step)
 *   onCombatDamageToMonarch(game, dealerSeat)     -> events: the attacker steals the crown
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMonarch = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function monarch(game) {
    for (var s = 0; s < game.seats; s++) { if (game.players[s] && game.players[s].isMonarch) return s; }
    return null;
  }

  function setMonarch(game, seat) {
    var out = [];
    for (var s = 0; s < game.seats; s++) {
      var want = (s === seat);
      if (!!(game.players[s] && game.players[s].isMonarch) !== want) out.push({ t: "__set", players: [{ seat: s, fields: { isMonarch: want } }] });
    }
    return out;
  }

  // the monarch draws a card at the beginning of their end step
  function endStepDraw(game, seat) {
    return monarch(game) === seat ? [{ t: "draw", seat: seat, count: 1 }] : [];
  }

  // a creature dealing combat damage to the monarch makes its controller the new monarch
  function onCombatDamageToMonarch(game, dealerSeat) {
    var cur = monarch(game);
    if (cur == null || cur === dealerSeat) return [];
    return setMonarch(game, dealerSeat);
  }

  return { monarch: monarch, setMonarch: setMonarch, endStepDraw: endStepDraw, onCombatDamageToMonarch: onCombatDamageToMonarch };
});

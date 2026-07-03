/*
 * rules-extort.js — extort (CR 702.100). PURE.
 * Browser global (window.MTGRulesExtort) + Node module. "Whenever you cast a spell, you may pay {W/B}.
 * If you do, each opponent loses 1 life and you gain that much life." Extort triggers once per extorting
 * permanent you control, for EACH spell you cast — and it can be paid repeatedly (each extort permanent
 * separately). This module is a pure decision layer: enumerate the triggers, and compute the life swing
 * when a controller pays for K of them against a given set of opponents.
 *
 *   def.abilities = [..., "extort"]
 *
 *   hasExtort(game, id, ctx)                              -> does this permanent extort
 *   extortSources(game, casterSeat, ctx)                 -> [ids] of your extort permanents (each = one trigger)
 *   extortEvents(game, casterSeat, opponentSeats, timesPaid, ctx)
 *                                                        -> [adjust_life …]: each opp -K, caster +K*opps
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesExtort = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function defOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    return (c && Cards && Cards.get(c.name)) || null;
  }

  function hasExtort(game, id, ctx) {
    var def = defOf(game, id, ctx);
    return !!(def && (def.abilities || []).indexOf("extort") >= 0);
  }

  // every extort permanent the caster controls on the battlefield triggers once per spell cast
  function extortSources(game, casterSeat, ctx) {
    var out = [];
    Object.keys(game.cards).sort().forEach(function (id) {
      var c = game.cards[id];
      if (c && c.zone === "battlefield" && c.controllerSeat === casterSeat && hasExtort(game, id, ctx)) out.push(id);
    });
    return out;
  }

  // life swing when the caster pays extort `timesPaid` times against `opponentSeats`:
  // each opponent loses `timesPaid`, caster gains timesPaid * (#opponents).
  function extortEvents(game, casterSeat, opponentSeats, timesPaid, ctx) {
    var k = timesPaid | 0; if (k <= 0) return [];
    var opps = (opponentSeats || []).filter(function (s) { return s !== casterSeat; });
    if (!opps.length) return [];
    var events = [];
    opps.forEach(function (s) { events.push({ t: "adjust_life", seat: s, delta: -k }); });
    events.push({ t: "adjust_life", seat: casterSeat, delta: k * opps.length });
    return events;
  }

  return { hasExtort: hasExtort, extortSources: extortSources, extortEvents: extortEvents };
});

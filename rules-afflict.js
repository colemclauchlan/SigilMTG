/*
 * rules-afflict.js — afflict N (CR 702.131). PURE.
 * Browser global (window.MTGRulesAfflict) + Node module. "Afflict N — Whenever this creature becomes
 * blocked, defending player loses N life." A becomes-blocked trigger: the life loss happens at
 * declare-blockers time and does NOT depend on combat damage (the classic afflict trick — blocking
 * still hurts). The returned event is a plain adjust_life the driver dispatches; life LOSS is not
 * damage, so lifelink/protection/prevention on the blockers never applies.
 *
 *   def.afflict = N  (e.g. Cards.define("Khenra Eternal", { ..., afflict: 1 }))
 *
 *   afflictN(def)                          -> N (0 when absent/invalid)
 *   onBlocked(game, id, defendingSeat)     -> [adjust_life(defendingSeat, -N)] or []
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAfflict = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function afflictN(def) {
    var n = def && def.afflict;
    return (typeof n === "number" && n > 0) ? Math.floor(n) : 0;
  }

  // The attacker became blocked: the defending player loses N life (once, however many blockers).
  function onBlocked(game, id, defendingSeat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game && game.cards ? game.cards[id] : null;
    if (!c || c.zone !== "battlefield") return [];
    if (defendingSeat == null || !game.players || !game.players[defendingSeat]) return [];
    var n = afflictN(Cards && Cards.get(c.name));
    if (!n) return [];
    return [{ t: "adjust_life", seat: defendingSeat, delta: -n }];
  }

  return { afflictN: afflictN, onBlocked: onBlocked };
});

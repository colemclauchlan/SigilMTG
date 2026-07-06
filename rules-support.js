/*
 * rules-support.js — support N (CR 701.42). PURE.
 * Browser global (window.MTGRulesSupport) + Node module. "Support N: put a +1/+1 counter on each of up to N
 * target creatures." (Support on a creature targets other creatures; support on a noncreature can target
 * itself.) This module validates the chosen targets and emits one +1/+1 counter per target.
 *
 *   def.support = 2     // N (max number of creatures)
 *
 *   supportN(def)                                       -> N, or null
 *   canSupport(game, sourceId, targetIds, seat, ctx)    -> { ok, reason }  (<= N creature targets)
 *   supportEvents(game, targetIds, ctx)                 -> [card_counter +1/+1 on each target]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSupport = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function supportN(def) { return (def && def.support != null) ? def.support : null; }

  function canSupport(game, sourceId, targetIds, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var n = supportN(Cards && Cards.get((game.cards[sourceId] || {}).name));
    if (n == null) return { ok: false, reason: "no support" };
    targetIds = targetIds || [];
    if (targetIds.length > n) return { ok: false, reason: "at most " + n + " target creatures" };
    for (var i = 0; i < targetIds.length; i++) {
      var t = game.cards[targetIds[i]];
      if (!t || t.zone !== "battlefield" || !isCreature(Cards && Cards.get(t.name))) return { ok: false, reason: "targets must be creatures on the battlefield" };
      if (targetIds.indexOf(targetIds[i]) !== i) return { ok: false, reason: "each creature can be targeted only once" };
    }
    return { ok: true };
  }

  // one +1/+1 counter on each chosen target creature
  function supportEvents(game, targetIds, ctx) {
    return (targetIds || []).filter(function (id) { return game.cards[id]; }).map(function (id) {
      return { t: "card_counter", instanceId: id, kind: "+1/+1", delta: 1 };
    });
  }

  return { supportN: supportN, canSupport: canSupport, supportEvents: supportEvents };
});

/*
 * rules-ward.js — ward (CR 702.21). PURE.
 * Browser global (window.MTGRulesWard) + Node module. "Ward [cost]" is a triggered ability of a permanent:
 * "Whenever this permanent becomes the target of a spell or ability an opponent controls, counter that
 * spell or ability unless that player pays [cost]." Sits alongside rules-ward-less protection/hexproof:
 * it does not stop targeting, it taxes it — and only when the targeter is an OPPONENT of the permanent's
 * controller. This module is a pure decision layer (no events): does ward trigger, and was it paid?
 *
 *   def.ward = { generic:2 }  /  def.ward = "hexproof"  (some wards aren't mana — kept as an opaque cost)
 *
 *   wardCost(game, cardId, ctx)                               -> the ward cost, or null (no ward)
 *   triggersWard(game, cardId, controllerSeat, targeterSeat, ctx)
 *                                                             -> true only if the card has ward AND the
 *                                                                targeter is an opponent of the controller
 *   resolveWard(paid)                                         -> { countered } (countered unless paid)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesWard = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function wardCost(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return null;
    var def = Cards && Cards.get(c.name);
    return (def && def.ward != null) ? def.ward : null;
  }

  function hasWard(game, cardId, ctx) { return wardCost(game, cardId, ctx) != null; }

  // ward triggers only when an OPPONENT (a different seat) targets the warded permanent
  function triggersWard(game, cardId, controllerSeat, targeterSeat, ctx) {
    if (!hasWard(game, cardId, ctx)) return false;
    return targeterSeat !== controllerSeat;   // your own spells/abilities don't trigger your ward
  }

  // resolution: the offending spell/ability is countered UNLESS the ward cost was paid
  function resolveWard(paid) { return { countered: !paid }; }

  return { wardCost: wardCost, hasWard: hasWard, triggersWard: triggersWard, resolveWard: resolveWard };
});

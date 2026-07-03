/*
 * rules-combat-declare.js — rules-correct attack/block declaration. PURE.
 * Browser global (window.MTGCombatDeclare) + Node module. Ties together summoning sickness, the
 * blocking AI, and evasion into legal combat declarations:
 *   declareAttackers(game, seat, ctx) -> [{attacker, blockers:[]}]  // only creatures that CAN attack
 *   declareBlocks(game, defenderSeat, attackPlan, ctx) -> attackPlan // AI blocks, then illegal ones stripped
 * Composes rules-sickness (canAttack), rules-blocking (chooseBlocks), rules-evasion (filterLegalBlocks).
 * Falls back gracefully if a module isn't loaded.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCombatDeclare = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function declareAttackers(game, seat, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), Cards = pick(ctx, "Cards", "MTGCards"), Sick = pick(ctx, "Sickness", "MTGRulesSickness");
    return Core.cardsOf(game, seat, "battlefield").filter(function (c) {
      var def = Cards ? Cards.get(c.name) : null;
      if (!def || def.types.indexOf("creature") < 0) return false;
      return Sick ? Sick.canAttack(game, c.instanceId, ctx) : !c.tapped;
    }).map(function (c) { return { attacker: c.instanceId, blockers: [] }; });
  }

  function declareBlocks(game, defenderSeat, attackPlan, ctx) {
    var Block = pick(ctx, "Blocking", "MTGRulesBlocking"), Ev = pick(ctx, "Evasion", "MTGRulesEvasion");
    var plan = Block ? Block.chooseBlocks(game, defenderSeat, attackPlan, ctx) : attackPlan;
    return Ev ? Ev.filterLegalBlocks(game, plan, ctx) : plan;
  }

  return { declareAttackers: declareAttackers, declareBlocks: declareBlocks };
});

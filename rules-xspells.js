/*
 * rules-xspells.js — spells & abilities with {X} in the cost (CR 107.3 / 601.2b). PURE.
 * Browser global (window.MTGRulesXSpells) + Node module. {X} is chosen as you cast; X generic mana is
 * added to the cost and the effect scales with X (Fireball = X damage; a hydra enters with X +1/+1).
 * Composes rules-mana for legality/affordability.
 *
 *   xCost(baseMana, x)                    -> a concrete cost ({X} resolved to `x` generic)
 *   maxAffordableX(baseMana, pool, ctx)    -> the largest X the pool can pay
 *   xDamageEffects(target, x)              -> [damage x to a player (life) or creature (marked)]
 *   xCounterEvents(instanceId, x, kind?)   -> [put x counters (default +1/+1) on a permanent]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesXSpells = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

  function xCost(baseMana, x) { var c = clone(baseMana); c.generic = (c.generic || 0) + (x || 0); return c; }

  function maxAffordableX(baseMana, pool, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"); if (!Mana) return 0;
    var cap = 0; for (var k in (pool || {})) cap += pool[k] || 0;
    var x = 0; while (x < cap && Mana.canPay(xCost(baseMana, x + 1), pool)) x++;
    return x;
  }

  function xDamageEffects(target, x) {
    if (!target || !(x > 0)) return [];
    return target.kind === "player"
      ? [{ t: "adjust_life", seat: target.seat, delta: -x }]
      : [{ t: "card_counter", instanceId: target.instanceId, kind: "damage", delta: x }];
  }

  function xCounterEvents(instanceId, x, kind) {
    return x > 0 ? [{ t: "card_counter", instanceId: instanceId, kind: kind || "+1/+1", delta: x }] : [];
  }

  return { xCost: xCost, maxAffordableX: maxAffordableX, xDamageEffects: xDamageEffects, xCounterEvents: xCounterEvents };
});

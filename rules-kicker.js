/*
 * rules-kicker.js — kicker & multikicker (CR 702.33 / 702.40). PURE.
 * Browser global (window.MTGRulesKicker) + Node module. An optional ADDITIONAL cost paid as you cast; if
 * paid, the spell gets a bonus effect (multikicker = pay it any number of times, scaling the bonus).
 * Composes rules-mana for affordability and assembles the final effects.
 *
 *   def.kicker = { generic:2 }                 // the (each) kicker cost
 *   def.spell  = { effects:[…base…], kickedEffects:[…bonus, applied once per kick…] }
 *
 *   costWithKicker(baseMana, kicker, times)        -> total cost paying the kicker `times` times
 *   canKick(baseMana, kicker, times, pool, ctx)     -> can the pool pay base + times×kicker?
 *   effects(def, times, card, target)               -> base effects + the bonus repeated `times`
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesKicker = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

  function costWithKicker(baseMana, kicker, times) {
    var c = clone(baseMana); times = times || 0;
    for (var k in (kicker || {})) { var add = (kicker[k] || 0) * times; if (add) c[k] = (c[k] || 0) + add; }  // don't write a 0 key when unkicked
    return c;
  }

  function canKick(baseMana, kicker, times, pool, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana");
    return Mana ? Mana.canPay(costWithKicker(baseMana, kicker, times), pool) : null;
  }

  function bind(effects, card, target) {
    return (effects || []).map(function (e) {
      var o = {}; for (var k in e) o[k] = e[k];
      if (o.seat === "controller" && card) o.seat = card.controllerSeat;
      else if (o.seat === "owner" && card) o.seat = card.ownerSeat;
      else if (o.seat === "target" && target && target.kind === "player") o.seat = target.seat;
      if (o.instanceId === "target" && target && target.kind === "card") o.instanceId = target.instanceId;
      return o;
    });
  }

  function effects(def, times, card, target) {
    var sp = (def && def.spell) || {}, out = bind(sp.effects, card, target);
    for (var i = 0; i < (times || 0); i++) out = out.concat(bind(sp.kickedEffects, card, target));
    return out;
  }

  return { costWithKicker: costWithKicker, canKick: canKick, effects: effects };
});

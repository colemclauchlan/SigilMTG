/*
 * rules-mentor.js — mentor (CR 702.137). PURE.
 * Browser global (window.MTGRulesMentor) + Node module. "Whenever this creature attacks, put a +1/+1
 * counter on target attacking creature with lesser power." Mentor triggers on attack and targets ANOTHER
 * attacking creature whose EFFECTIVE power is strictly less than the mentor's own effective power; on
 * resolution it puts a +1/+1 counter on that target (which can chain — a mentored creature can grow past
 * other mentors). Power comparison is over effective P/T (counters, anthems, granted keywords) via
 * rules-keywords/rules-layers, so a creature pumped this turn is compared at its current power.
 *
 *   mentorTargets(game, mentorId, attackerIds, ctx)     -> [ids] of legal lesser-power attacking targets
 *   applyMentor(game, mentorId, targetId, ctx)          -> [ counter event ] (or [] if the target is illegal)
 *
 * Honors GRANTED mentor (a creature granted "mentor" triggers); a creature never mentors itself, and a
 * target must itself be an attacker. Targets of EQUAL or greater power are excluded (strict "lesser").
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMentor = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }

  // effective power of a card on the board (counters/anthems/grants), or null if unknown
  function powerOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), Layers = pick(ctx, "Layers", "MTGRulesLayers");
    var c = game.cards[id]; if (!c) return null;
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e && e.power != null) return e.power; }
    var def = Cards && Cards.get(c.name);
    if (def && Layers) {
      var base = Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat });
      return Layers.computeEffectiveState(base, []).power;
    }
    return def ? def.power : null;
  }

  function hasMentor(abilities) { return (abilities || []).indexOf("mentor") >= 0; }

  // legal targets: OTHER attacking creatures whose effective power is strictly less than the mentor's
  function mentorTargets(game, mentorId, attackerIds, ctx) {
    var ab = abilitiesOf(game, mentorId, ctx);
    if (!hasMentor(ab)) return [];
    var mp = powerOf(game, mentorId, ctx); if (mp == null) return [];
    var out = [];
    (attackerIds || []).forEach(function (id) {
      if (id === mentorId) return;
      var p = powerOf(game, id, ctx);
      if (p != null && p < mp) out.push(id);
    });
    return out;
  }

  // resolve mentor onto a chosen target: +1/+1 counter, but only if that target is currently legal
  function applyMentor(game, mentorId, targetId, ctx) {
    var Counters = pick(ctx, "Counters", "MTGRulesCounters");
    var legal = mentorTargets(game, mentorId, [targetId], ctx);
    if (legal.indexOf(targetId) < 0) return [];
    if (Counters && Counters.placeCounters) return [Counters.placeCounters(targetId, "+1/+1", 1)];
    return [{ t: "card_counter", instanceId: targetId, kind: "+1/+1", delta: 1 }];
  }

  return { abilitiesOf: abilitiesOf, powerOf: powerOf, hasMentor: hasMentor, mentorTargets: mentorTargets, applyMentor: applyMentor };
});

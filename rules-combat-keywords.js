/*
 * rules-combat-keywords.js — combat with keyword side-effects (lifelink). PURE (drives engine-core).
 * Browser global (window.MTGCombatKeywords) + Node module. Same board application as
 * rules-combat-turn.runCombat, but also grants life for LIFELINK: a creature that deals combat damage
 * makes its controller gain that much life (a creature deals its full power in combat, to blockers
 * and/or trampling, so the gain is its effective power). Reuses rules-combat-turn.effectiveCreature.
 * Deathtouch/trample/first-strike live in the combat resolvers; this adds the life-gain side effect.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCombatKeywords = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function kw(c, k) { return (c.abilities || []).indexOf(k) >= 0; }

  function runCombatKW(E, estate, defenderSeat, attackPlan, ctx) {
    var CT = pick(ctx, "CombatTurn", "MTGCombatTurn"), Combat = pick(ctx, "Combat", "MTGRulesCombat"), s = estate;
    (attackPlan || []).forEach(function (pair) {
      var atkCard = s.game.cards[pair.attacker]; if (!atkCard) return;
      var attackerSeat = atkCard.controllerSeat;
      var atk = CT.effectiveCreature(s, pair.attacker, ctx); if (!atk) return;
      var blks = (pair.blockers || []).map(function (id) { return CT.effectiveCreature(s, id, ctx); }).filter(Boolean);
      var r = Combat.resolveAttack(atk, blks);

      if (!kw(atk, "vigilance") && !atkCard.tapped) s = E.dispatch(s, { t: "card_tap", instanceId: pair.attacker, tapped: true });
      if (r.trample > 0) s = E.dispatch(s, { t: "adjust_life", seat: defenderSeat, delta: -r.trample });

      // lifelink: the attacker's controller gains life equal to the damage it dealt (its full power)
      if (kw(atk, "lifelink") && (atk.power || 0) > 0) s = E.dispatch(s, { t: "adjust_life", seat: attackerSeat, delta: atk.power });
      // lifelink: each blocker's controller (the defender) gains life equal to that blocker's power
      blks.forEach(function (b) { if (kw(b, "lifelink") && (b.power || 0) > 0) s = E.dispatch(s, { t: "adjust_life", seat: defenderSeat, delta: b.power }); });

      // marked damage + deaths
      [r.attacker].concat(r.blockers).forEach(function (cr) {
        var card = s.game.cards[cr.id]; if (!card) return;
        if (Combat.isDead(cr)) { s = E.dispatch(s, { t: "card_move", instanceId: cr.id, toZone: "graveyard" }); }
        else if (cr.markedDamage > 0) {
          var cur = (card.counters && card.counters.damage) || 0, delta = cr.markedDamage - cur;
          if (delta) s = E.dispatch(s, { t: "card_counter", instanceId: cr.id, kind: "damage", delta: delta });
        }
      });
    });
    return s;
  }

  return { runCombatKW: runCombatKW };
});

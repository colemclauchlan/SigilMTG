/*
 * rules-combat-turn-fs.js — applies FIRST/DOUBLE-STRIKE-aware combat to the engine board. PURE.
 * Browser global (window.MTGCombatTurnFS) + Node module. Same role as rules-combat-turn.runCombat,
 * but resolves each fight with the two-step resolver (rules-combat-fs) so first strike / double strike
 * are honored on the live board (e.g. a first-striker kills its blocker before taking damage back).
 * Reuses rules-combat-turn.effectiveCreature for the board read. Nothing is mutated directly.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCombatTurnFS = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function runCombatFS(E, estate, defenderSeat, attackPlan, ctx) {
    var CT = pick(ctx, "CombatTurn", "MTGCombatTurn"),
        FS = pick(ctx, "CombatFS", "MTGCombatFS"),
        Combat = pick(ctx, "Combat", "MTGRulesCombat"),
        s = estate;
    (attackPlan || []).forEach(function (pair) {
      var atk = CT.effectiveCreature(s, pair.attacker, ctx); if (!atk) return;
      var blks = (pair.blockers || []).map(function (id) { return CT.effectiveCreature(s, id, ctx); }).filter(Boolean);
      var r = FS.resolveCombatFS(atk, blks);

      if ((atk.abilities || []).indexOf("vigilance") < 0 && s.game.cards[pair.attacker] && !s.game.cards[pair.attacker].tapped) {
        s = E.dispatch(s, { t: "card_tap", instanceId: pair.attacker, tapped: true });
      }
      if (r.trample > 0) s = E.dispatch(s, { t: "adjust_life", seat: defenderSeat, delta: -r.trample });

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

  return { runCombatFS: runCombatFS };
});

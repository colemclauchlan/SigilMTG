/*
 * rules-combat-turn.js — applies a declared combat to the engine board. PURE (drives engine-core).
 * Browser global (window.MTGCombatTurn) + Node module. Bridges the combat math (rules-combat) to the
 * live board: it reads each creature's EFFECTIVE P/T (via card-defs + rules-layers), resolves each
 * attacker-vs-blockers fight, then applies the outcome through engine dispatches — taps attackers
 * (unless vigilance), deals unblocked/trample damage to the defending player, marks combat damage,
 * and moves lethally-damaged creatures to the graveyard. Nothing is mutated directly.
 *
 *   attackPlan = [ { attacker: instanceId, blockers: [instanceId, …] }, … ]
 *
 * Deferred (documented): first/double strike (a two-step variant), combat triggers, summoning
 * sickness enforcement (declareAllAttackers currently attacks with any untapped creature).
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  if (root) root.MTGCombatTurn = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || (root && root[global]); }

  // effective combat profile of a creature on the board
  function effectiveCreature(estate, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Layers = pick(ctx, "Layers", "MTGRulesLayers");
    var c = estate.game.cards[id]; if (!c) return null;
    var def = Cards.get(c.name);
    var base = def
      ? Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat })
      : { name: c.name, power: c.power, toughness: c.toughness, counters: c.counters || {}, types: [], subtypes: [], colors: [], abilities: [] };
    var eff = Layers.computeEffectiveState(base, c._effects || []);
    return { id: id, power: eff.power, toughness: eff.toughness, abilities: eff.abilities || [], markedDamage: (c.counters && c.counters.damage) || 0 };
  }

  function runCombat(E, estate, defenderSeat, attackPlan, ctx) {
    var Combat = pick(ctx, "Combat", "MTGRulesCombat"), s = estate;
    (attackPlan || []).forEach(function (pair) {
      var atk = effectiveCreature(s, pair.attacker, ctx); if (!atk) return;
      var blks = (pair.blockers || []).map(function (id) { return effectiveCreature(s, id, ctx); }).filter(Boolean);
      var r = Combat.resolveAttack(atk, blks);

      // attacking taps the attacker unless it has vigilance
      if (atk.abilities.indexOf("vigilance") < 0 && s.game.cards[pair.attacker] && !s.game.cards[pair.attacker].tapped) {
        s = E.dispatch(s, { t: "card_tap", instanceId: pair.attacker, tapped: true });
      }
      // unblocked / trample damage hits the defending player
      if (r.trample > 0) s = E.dispatch(s, { t: "adjust_life", seat: defenderSeat, delta: -r.trample });

      // apply marked damage; lethal creatures are destroyed (move to graveyard)
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

  // declare every untapped creature the seat controls as an (unblocked) attacker
  function declareAllAttackers(estate, seat, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), Cards = pick(ctx, "Cards", "MTGCards"), out = [];
    Core.cardsOf(estate.game, seat, "battlefield").forEach(function (c) {
      var def = Cards.get(c.name);
      if (def && def.types.indexOf("creature") >= 0 && !c.tapped) out.push({ attacker: c.instanceId, blockers: [] });
    });
    return out;
  }

  return { effectiveCreature: effectiveCreature, runCombat: runCombat, declareAllAttackers: declareAllAttackers };
});

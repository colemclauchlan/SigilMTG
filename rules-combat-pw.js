/*
 * rules-combat-pw.js — attacking planeswalkers (CR 508/509/120.3). PURE (drives engine-core).
 * Browser global (window.MTGCombatPW) + Node module. Extends the board combat applicator so an
 * attacker can be declared at a planeswalker instead of a player: the combat damage that would have
 * hit the defending player (full power when unblocked, trample overflow when blocked) is removed as
 * LOYALTY from the target planeswalker (a `loyalty` counter). Blocked-fight math, taps, marked damage
 * and lethal destruction are identical to rules-combat-turn (reused via its effectiveCreature). A
 * planeswalker reduced to 0 loyalty is caught by rules-loyalty.deadPlaneswalkers (an SBA — caller).
 *
 *   attackPlan = [ { attacker: id, blockers: [id…], target?: planeswalkerId }, … ]
 *
 * (Redirection of damage to the player vs PW is fixed at declaration; "trample over planeswalkers" —
 * CR 702.19e — is the rare exception and is deferred/documented.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCombatPW = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  // resolve a target id to a planeswalker the defender controls, else null (damage falls back to player)
  function pwTarget(estate, defenderSeat, targetId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = targetId && estate.game.cards[targetId];
    if (!c || c.zone !== "battlefield" || c.controllerSeat !== defenderSeat) return null;
    var def = Cards && Cards.get(c.name);
    return (def && def.types.indexOf("planeswalker") >= 0) ? c : null;
  }

  function runCombatPW(E, estate, defenderSeat, attackPlan, ctx) {
    var Combat = pick(ctx, "Combat", "MTGRulesCombat"), CT = pick(ctx, "CombatTurn", "MTGCombatTurn"), s = estate;
    (attackPlan || []).forEach(function (pair) {
      var atk = CT.effectiveCreature(s, pair.attacker, ctx); if (!atk) return;
      var blks = (pair.blockers || []).map(function (id) { return CT.effectiveCreature(s, id, ctx); }).filter(Boolean);
      var r = Combat.resolveAttack(atk, blks);

      if (atk.abilities.indexOf("vigilance") < 0 && s.game.cards[pair.attacker] && !s.game.cards[pair.attacker].tapped) {
        s = E.dispatch(s, { t: "card_tap", instanceId: pair.attacker, tapped: true });
      }
      // to-player damage: redirect to the target planeswalker (loyalty loss) if one was declared
      if (r.trample > 0) {
        var pw = pair.target ? pwTarget(s, defenderSeat, pair.target, ctx) : null;
        if (pw) s = E.dispatch(s, { t: "card_counter", instanceId: pw.instanceId, kind: "loyalty", delta: -r.trample });
        else s = E.dispatch(s, { t: "adjust_life", seat: defenderSeat, delta: -r.trample });
      }
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

  function attackPW(attackerId, pwId, blockers) { return { attacker: attackerId, target: pwId, blockers: blockers || [] }; }

  // send every untapped creature a seat controls at a given planeswalker
  function declareAttackersAtPW(estate, seat, pwId, ctx) {
    var CT = pick(ctx, "CombatTurn", "MTGCombatTurn");
    return CT.declareAllAttackers(estate, seat, ctx).map(function (e) { e.target = pwId; return e; });
  }

  return { runCombatPW: runCombatPW, attackPW: attackPW, declareAttackersAtPW: declareAttackersAtPW, pwTarget: pwTarget };
});

/*
 * rules-combat.js — Phase R4 combat damage system. PURE.
 * Browser global (window.MTGRulesCombat) + Node module. Operates on EFFECTIVE creatures
 * (power/toughness already computed by rules-layers R2) plus keyword abilities, and computes
 * marked damage, lethality, and trample-through to the defending player. Nothing is mutated.
 *
 * Creature shape: { id, power, toughness, abilities:[], markedDamage?, deathtouched? }
 * v1 models a single (simultaneous) combat damage step with: deathtouch (any damage is lethal),
 * trample (assign lethal to blockers, excess to the player), and multi-blocker ordered assignment.
 * Deferred & documented: first strike / double strike (a two-step variant), banding, protection.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesCombat = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hasKw(c, k) { return (c.abilities || []).indexOf(k) >= 0; }

  // Mark `amount` damage on a creature (optionally from a deathtouch source).
  function damaged(creature, amount, deathtouch) {
    var c = clone(creature);
    c.markedDamage = (c.markedDamage || 0) + (amount || 0);
    if (deathtouch && amount > 0) c.deathtouched = true;
    return c;
  }
  // Would this creature be destroyed by state-based actions right now? (CR 704.5g/h/i)
  function isDead(creature) {
    var t = creature.toughness;
    if (t != null && t <= 0) return true;                 // 0 or less toughness
    var dmg = creature.markedDamage || 0;
    if (dmg <= 0) return false;
    if (creature.deathtouched) return true;               // any damage from deathtouch
    return t != null && dmg >= t;                          // lethal marked damage
  }
  function lethalRemaining(blocker, deathtouch) {
    if (deathtouch) return 1;
    return Math.max(0, (blocker.toughness || 0) - (blocker.markedDamage || 0));
  }

  // Resolve one attacker against an ordered list of blockers. Returns updated creatures and the
  // damage that tramples through to the defending player (also = full power when unblocked).
  function resolveAttack(attacker, blockers) {
    blockers = blockers || [];
    var atkDT = hasKw(attacker, "deathtouch"), tramp = hasKw(attacker, "trample");
    var remaining = attacker.power || 0, trample = 0, outBlockers = [];

    if (blockers.length === 0) {
      trample = remaining;                                  // unblocked -> straight to the player
    } else {
      for (var i = 0; i < blockers.length; i++) {
        var b = blockers[i], last = (i === blockers.length - 1);
        var lethal = Math.min(lethalRemaining(b, atkDT), remaining);
        var assign = (!tramp && last) ? remaining : lethal; // no trample: pile leftover on the last blocker
        outBlockers.push(damaged(b, assign, atkDT));
        remaining = Math.max(0, remaining - assign);
      }
      if (tramp) trample = remaining;
    }
    // blockers deal their power back to the attacker simultaneously
    var atk = attacker;
    blockers.forEach(function (b) { atk = damaged(atk, b.power || 0, hasKw(b, "deathtouch")); });

    return { attacker: atk, blockers: outBlockers, trample: trample };
  }

  return { damaged: damaged, isDead: isDead, lethalRemaining: lethalRemaining, resolveAttack: resolveAttack, hasKeyword: hasKw };
});

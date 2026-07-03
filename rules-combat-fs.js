/*
 * rules-combat-fs.js — first-strike / double-strike combat (two damage steps). PURE.
 * Browser global (window.MTGCombatFS) + Node module. Composes rules-combat's primitives
 * (damaged / isDead / lethalRemaining) into the CR-510 two-step combat damage sequence:
 *   - first-strike step: only creatures with "first strike" or "double strike" deal damage;
 *   - regular step: creatures without first strike, plus double-strikers (again), deal damage —
 *     and any creature that died in the first step deals nothing.
 * Handles deathtouch and trample within each step. Nothing is mutated (operates on copies).
 *
 * Creature shape (effective): { id, power, toughness, abilities:[], markedDamage?, deathtouched? }
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCombatFS = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function Comb() { return root.MTGRulesCombat; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function kw(c, k) { return (c.abilities || []).indexOf(k) >= 0; }
  function dealsFirst(c) { return kw(c, "first strike") || kw(c, "double strike"); }
  function dealsRegular(c) { return !kw(c, "first strike") || kw(c, "double strike"); } // no first strike, or double strike

  // attacker assigns its power across the live blockers (lethal each in order, trample excess)
  function assignAttacker(attacker, liveBlockers) {
    var C = Comb(), atkDT = kw(attacker, "deathtouch"), tramp = kw(attacker, "trample");
    var remaining = attacker.power || 0, trample = 0, assign = {};
    if (!liveBlockers.length) return { assign: assign, trample: remaining };
    for (var i = 0; i < liveBlockers.length; i++) {
      var b = liveBlockers[i], last = (i === liveBlockers.length - 1);
      var lethal = C.lethalRemaining(b, atkDT), give = Math.min(lethal, remaining);
      if (!tramp && last) give = remaining;
      assign[b.id] = give; remaining = Math.max(0, remaining - give);
    }
    if (tramp) trample = remaining;
    return { assign: assign, trample: trample };
  }

  function resolveCombatFS(attacker, blockers) {
    var C = Comb();
    var atk = clone(attacker); atk.markedDamage = atk.markedDamage || 0;
    var blks = (blockers || []).map(function (b) { var x = clone(b); x.markedDamage = x.markedDamage || 0; return x; });
    var trample = 0;

    function step(firstStep) {
      var live = blks.filter(function (b) { return !C.isDead(b); });
      var atkDeals = (firstStep ? dealsFirst(atk) : dealsRegular(atk)) && !C.isDead(atk);
      var pending = atkDeals ? assignAttacker(atk, live) : { assign: {}, trample: 0 };

      var toAtk = 0, atkDT = false;
      live.forEach(function (b) {
        if (firstStep ? dealsFirst(b) : dealsRegular(b)) { toAtk += (b.power || 0); if (kw(b, "deathtouch")) atkDT = true; }
      });

      if (atkDeals) {
        for (var id in pending.assign) {
          for (var i = 0; i < blks.length; i++) if (blks[i].id === id) { blks[i] = C.damaged(blks[i], pending.assign[id], kw(atk, "deathtouch")); break; }
        }
        trample += pending.trample;
      }
      if (toAtk > 0) atk = C.damaged(atk, toAtk, atkDT);
    }

    if (dealsFirst(atk) || blks.some(dealsFirst)) step(true);   // first-strike step (only if anyone has it)
    step(false);                                                 // regular step

    return { attacker: atk, blockers: blks, trample: trample };
  }

  return { resolveCombatFS: resolveCombatFS, dealsFirst: dealsFirst, dealsRegular: dealsRegular };
});

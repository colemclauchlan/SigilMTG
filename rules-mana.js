/*
 * rules-mana.js — mana cost payment + casting legality. PURE.
 * Browser global (window.MTGRulesMana) + Node module. Decides whether a mana cost can be paid
 * from a mana pool and computes the pool that remains. Used for casting legality (can this spell
 * be cast right now?) before an action is allowed. Nothing is mutated.
 *
 *   cost = { W,U,B,R,G,C, generic }   // colored/colorless symbols + a generic amount
 *   pool = { W,U,B,R,G,C }            // available mana of each type (e.g. from rules-mana.poolFromCounters)
 *
 * v1 handles colored + colorless + generic. Hybrid and Phyrexian mana are deferred (documented):
 * they'd extend canPay/pay with alternative payment options.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMana = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var COLORS = ["W", "U", "B", "R", "G", "C"];
  var GEN_ORDER = ["C", "W", "U", "B", "R", "G"]; // spend colorless on generic first, preserve colored mana

  function clone(o) { var n = {}; for (var k in o) n[k] = o[k]; return n; }
  function total(pool) { var t = 0; for (var i = 0; i < COLORS.length; i++) t += (pool && pool[COLORS[i]]) || 0; return t; }

  // pay the colored/colorless symbols exactly; returns the reduced pool or null if a color is short
  function payColored(cost, pool) {
    var p = clone(pool || {});
    for (var i = 0; i < COLORS.length; i++) {
      var c = COLORS[i], need = cost[c] || 0;
      if ((p[c] || 0) < need) return null;
      p[c] = (p[c] || 0) - need;
    }
    return p;
  }

  function canPay(cost, pool) {
    cost = cost || {};
    var p = payColored(cost, pool || {});
    if (!p) return false;
    return total(p) >= (cost.generic || 0);
  }

  // returns the pool remaining after paying `cost`, or null if it can't be paid
  function pay(cost, pool) {
    cost = cost || {};
    var p = payColored(cost, pool || {});
    if (!p) return null;
    var gen = cost.generic || 0;
    for (var i = 0; i < GEN_ORDER.length && gen > 0; i++) {
      var c = GEN_ORDER[i], use = Math.min(gen, p[c] || 0);
      p[c] = (p[c] || 0) - use; gen -= use;
    }
    if (gen > 0) return null;
    return p;
  }

  // build a pool from table-core player counters ({ mana_R: 2, ... } -> { R: 2, ... })
  function poolFromCounters(counters) {
    var pool = {};
    if (!counters) return pool;
    for (var k in counters) { if (k.indexOf("mana_") === 0 && counters[k]) pool[k.slice(5)] = counters[k]; }
    return pool;
  }

  return { canPay: canPay, pay: pay, poolFromCounters: poolFromCounters, total: total, COLORS: COLORS };
});

/*
 * combat-duel.js — isolated, dependency-free MTG combat "duel" resolver.
 * Symmetric 1v1: both creatures deal damage to each other (like a creature blocking a creature),
 * honoring the core combat keywords. Pure functions (no DOM) so it can be unit-tested under node
 * and called from the board (table.js) without risk to the engine.
 *
 * Card shape (all optional except power/toughness):
 *   { name, power, toughness, counters:{ "+1/+1":n, "-1/-1":n }, keywords:[...], oracle:"...", colors:["R",...] }
 *
 * resolveDuel(A, B) -> { aDies, bDies, lifegain:{a,b}, damageToA, damageToB, steps:[] }
 *
 * Phase 2 (later): swap these internals to call the full rules engine (rules-combat + rules-sba)
 * once it is wired to the live board. The trigger/UI contract stays the same.
 */
(function (root) {
  "use strict";

  var COLOR = { w: "white", u: "blue", b: "black", r: "red", g: "green" };

  function has(card, name) {
    name = name.toLowerCase();
    var ks = (card.keywords || []).map(function (k) { return String(k).toLowerCase(); });
    if (ks.indexOf(name) >= 0) return true;
    if (ks.length) return false; // Scryfall's structured keywords are authoritative when present — no oracle guessing.
    // Fallback for cards with no keyword data (e.g. local/offline defs): oracle substring, but reject
    // granting phrasing so "creatures you control have deathtouch" / "gains trample" don't self-apply.
    var o = (card.oracle || card.oracle_text || "").toLowerCase();
    var idx = o.indexOf(name);
    if (idx < 0) return false;
    var before = o.slice(Math.max(0, idx - 28), idx);
    if (/\b(have|has|gain|gains|grant|grants|with)\b[^.]*$/.test(before)) return false;
    return true;
  }

  // effective power/toughness including +1/+1 and -1/-1 counters
  function eff(card) {
    var c = card.counters || {};
    var plus = c["+1/+1"] || 0, minus = c["-1/-1"] || 0;
    return { p: Math.max(0, (card.power || 0) + plus - minus), t: (card.toughness || 0) + plus - minus };
  }

  // is `def` protected from `atk` (protection from its color / from everything)?
  function protectedFrom(def, atk) {
    var o = (def.oracle || def.oracle_text || "").toLowerCase();
    if (o.indexOf("protection from everything") >= 0) return true;
    return (atk.colors || []).some(function (col) {
      var n = COLOR[String(col).toLowerCase()] || String(col).toLowerCase();
      return o.indexOf("protection from " + n) >= 0;
    });
  }

  function flags(card) {
    return {
      fs: has(card, "first strike"),
      ds: has(card, "double strike"),
      dt: has(card, "deathtouch"),
      ind: has(card, "indestructible"),
      ll: has(card, "lifelink"),
      tr: has(card, "trample")
    };
  }

  function resolveDuel(A, B) {
    var ea = eff(A), eb = eff(B), ka = flags(A), kb = flags(B);
    var SA = { t: ea.t, p: ea.p, ind: ka.ind, alive: true, dmg: 0, dtHit: false };
    var SB = { t: eb.t, p: eb.p, ind: kb.ind, alive: true, dmg: 0, dtHit: false };
    var life = { a: 0, b: 0 }, trample = { toA: 0, toB: 0 }, steps = [];
    var protB = protectedFrom(B, A); // B protected from A
    var protA = protectedFrom(A, B); // A protected from B

    // att deals its power to def (protection, deathtouch, lifelink, trample-to-player)
    function strike(af, Satt, Sdef, defProtected, lifeKey, trampleKey, label) {
      if (!Satt.alive || Satt.p <= 0 || defProtected) return;
      var dmg = Satt.p, toCreature = dmg, toPlayer = 0;
      if (af.tr) {                                   // trample: assign only lethal to the creature, the rest to its controller
        var lethalNeed = af.dt ? 1 : Math.max(0, Sdef.t - Sdef.dmg);
        toCreature = Math.min(dmg, lethalNeed);
        toPlayer = dmg - toCreature;
      }
      Sdef.dmg += toCreature;
      if (af.dt && toCreature > 0) Sdef.dtHit = true;
      if (toPlayer > 0) trample[trampleKey] += toPlayer;
      if (af.ll) life[lifeKey] += dmg;               // lifelink: life equal to ALL damage dealt
      steps.push(label + " deals " + toCreature + (toPlayer ? " (+" + toPlayer + " trample)" : ""));
    }

    // state-based check: lethal damage / 0 toughness / deathtouch, gated by indestructible
    function sba(S, who) {
      if (!S.alive) return;
      if (S.t <= 0) { S.alive = false; steps.push(who + " dies (0 toughness)"); return; }
      if (S.ind) return;
      if (S.dtHit && S.dmg > 0) { S.alive = false; steps.push(who + " dies (deathtouch)"); return; }
      if (S.dmg > 0 && S.dmg >= S.t) { S.alive = false; steps.push(who + " dies (lethal)"); }
    }

    // 0-toughness creatures die immediately (e.g. shrunk by -1/-1)
    sba(SA, "A"); sba(SB, "B");

    // first-strike combat damage step
    if (ka.fs || ka.ds || kb.fs || kb.ds) {
      if (ka.fs || ka.ds) strike(ka, SA, SB, protB, "a", "toB", "A(FS)");
      if (kb.fs || kb.ds) strike(kb, SB, SA, protA, "b", "toA", "B(FS)");
      sba(SB, "B"); sba(SA, "A");
    }

    // regular combat damage step: normal creatures + double-strikers (again).
    // first-strike-ONLY creatures already dealt and do not deal again.
    if (SA.alive && (!ka.fs || ka.ds)) strike(ka, SA, SB, protB, "a", "toB", "A");
    if (SB.alive && (!kb.fs || kb.ds)) strike(kb, SB, SA, protA, "b", "toA", "B");
    sba(SB, "B"); sba(SA, "A");

    return {
      aDies: !SA.alive, bDies: !SB.alive,
      lifegain: life, trample: trample, damageToA: SA.dmg, damageToB: SB.dmg, steps: steps
    };
  }

  var api = { resolveDuel: resolveDuel, _eff: eff, _has: has, _protectedFrom: protectedFrom };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MTGDuel = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));

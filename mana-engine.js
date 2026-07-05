/*
 * mana-engine.js — dependency-free mana-cost parser + payment checker (window.MTGMana).
 * Pure functions (no DOM) so it can be unit-tested under node and wired into the board later.
 * Cost strings use brace notation:  "{2}{W}{W}"  "{1}{U/R}"  "{G/P}"  "{2/W}"  "{X}{R}"
 * A mana pool is { W, U, B, R, G, C } (missing keys treated as 0).
 */
(function (root) {
  "use strict";
  var COLORS = ["W", "U", "B", "R", "G"];
  function emptyPool() { return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }; }
  function norm(pool) { var p = emptyPool(); if (pool) { ["W", "U", "B", "R", "G", "C"].forEach(function (k) { p[k] = pool[k] || 0; }); } return p; }

  function parse(str) {
    var cost = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, hybrid: [], phy: [], x: 0 };
    var toks = String(str || "").toUpperCase().match(/\{[^}]+\}/g) || [];
    toks.forEach(function (t) {
      var s = t.slice(1, -1);
      if (/^\d+$/.test(s)) { cost.generic += parseInt(s, 10); return; }
      if (s === "X" || s === "Y" || s === "Z") { cost.x += 1; return; }
      if (s === "W" || s === "U" || s === "B" || s === "R" || s === "G" || s === "C") { cost[s] += 1; return; }
      if (s.indexOf("/") >= 0) {
        var parts = s.split("/");
        if (parts.indexOf("P") >= 0) { cost.phy.push([parts.filter(function (x) { return x !== "P"; })[0] || "C"]); return; }
        cost.hybrid.push(parts); return;
      }
      cost.generic += 1;
    });
    return cost;
  }

  function cmc(str) {
    var c = parse(str), t = c.generic + c.W + c.U + c.B + c.R + c.G + c.C + c.phy.length;
    c.hybrid.forEach(function (h) { t += (h.length === 2 && /^\d+$/.test(h[0])) ? parseInt(h[0], 10) : 1; });
    return t;
  }

  function canPay(str, pool, opts) {
    opts = opts || {};
    var c = parse(str), p = norm(pool), i;
    for (i = 0; i < COLORS.length; i++) { if (p[COLORS[i]] < c[COLORS[i]]) return false; p[COLORS[i]] -= c[COLORS[i]]; }
    if (p.C < c.C) return false; p.C -= c.C;
    var genericExtra = 0;
    for (i = 0; i < c.hybrid.length; i++) {
      var opt = c.hybrid[i], paid = false;
      if (opt.length === 2 && /^\d+$/.test(opt[0])) {
        if (p[opt[1]] > 0) { p[opt[1]]--; paid = true; } else { genericExtra += parseInt(opt[0], 10); paid = true; }
      } else {
        for (var o = 0; o < opt.length && !paid; o++) { var oc = opt[o]; if (p[oc] > 0) { p[oc]--; paid = true; } }
        if (!paid) return false;
      }
    }
    for (i = 0; i < c.phy.length; i++) { var pc = c.phy[i][0]; if (p[pc] > 0) p[pc]--; else if (opts.noLife) return false; }
    var remaining = p.W + p.U + p.B + p.R + p.G + p.C;
    return remaining >= (c.generic + genericExtra);
  }

  function pay(str, pool, opts) {
    if (!canPay(str, pool, opts)) return null;
    var c = parse(str), p = norm(pool), i;
    COLORS.forEach(function (col) { p[col] -= c[col]; }); p.C -= c.C;
    var generic = c.generic;
    for (i = 0; i < c.hybrid.length; i++) {
      var opt = c.hybrid[i];
      if (opt.length === 2 && /^\d+$/.test(opt[0])) { if (p[opt[1]] > 0) p[opt[1]]--; else generic += parseInt(opt[0], 10); }
      else { for (var o = 0; o < opt.length; o++) { if (p[opt[o]] > 0) { p[opt[o]]--; break; } } }
    }
    for (i = 0; i < c.phy.length; i++) { var pc = c.phy[i][0]; if (p[pc] > 0) p[pc]--; }
    ["C", "W", "U", "B", "R", "G"].forEach(function (col) { while (generic > 0 && p[col] > 0) { p[col]--; generic--; } });
    return p;
  }

  var api = { parse: parse, cmc: cmc, canPay: canPay, pay: pay, emptyPool: emptyPool };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MTGMana = api;
  return api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));

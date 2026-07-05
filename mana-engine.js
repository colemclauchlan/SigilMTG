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

  // Parse a permanent's oracle text for the mana it can produce (auto-tap backbone).
  function produces(oracle) {
    var o = String(oracle || ""), out = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, anyColor: false, any: false, choices: [], amount: 0 };
    var wordN = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    var re = /add\s+([^.;\n)]+)/gi, m;
    while ((m = re.exec(o))) {
      var seg = m[1];
      if (/any color/i.test(seg)) { var w1 = (seg.match(/\b(one|two|three|four|five|\d+)\b/i) || [])[1]; out.anyColor = true; out.amount += (w1 ? (wordN[String(w1).toLowerCase()] || parseInt(w1, 10) || 1) : 1); continue; }
      if (/any (one )?type|any combination/i.test(seg)) { out.any = true; out.amount += 1; continue; }
      var syms = seg.match(/\{[WUBRGC]\}/gi);
      if (syms && syms.length) {
        if (/\bor\b/i.test(seg) && syms.length >= 2) { out.choices.push(syms.map(function (s) { return s.slice(1, -1).toUpperCase(); })); out.amount += 1; }
        else { syms.forEach(function (s) { var c = s.slice(1, -1).toUpperCase(); out[c] += 1; out.amount += 1; }); }
      }
    }
    return out;
  }

  function canTapFor(sources, cost, opts) {
    var pool = emptyPool(), flex = [];
    (sources || []).forEach(function (s) {
      if (!s) return;
      if (s.anyColor || s.any) { for (var n = 0; n < (s.amount || 1); n++) flex.push(["W", "U", "B", "R", "G", "C"]); return; }
      ["W", "U", "B", "R", "G", "C"].forEach(function (c) { pool[c] += (s[c] || 0); });
      (s.choices || []).forEach(function (ch) { flex.push(ch.slice()); });
    });
    function take(col) {
      if (pool[col] > 0) { pool[col]--; return true; }
      for (var i = 0; i < flex.length; i++) { if (flex[i].indexOf(col) >= 0) { flex.splice(i, 1); return true; } }
      return false;
    }
    var c = parse(cost), COLS = ["W", "U", "B", "R", "G", "C"], k, n;
    for (k = 0; k < COLS.length; k++) { for (n = 0; n < c[COLS[k]]; n++) if (!take(COLS[k])) return false; }
    for (k = 0; k < c.hybrid.length; k++) {
      var opt = c.hybrid[k];
      if (opt.length === 2 && /^\d+$/.test(opt[0])) { if (!take(opt[1])) c.generic += parseInt(opt[0], 10); }
      else { var paid = false; for (var oi = 0; oi < opt.length && !paid; oi++) paid = take(opt[oi]); if (!paid) return false; }
    }
    for (k = 0; k < c.phy.length; k++) { if (!take(c.phy[k][0]) && opts && opts.noLife) return false; }
    return (pool.W + pool.U + pool.B + pool.R + pool.G + pool.C + flex.length) >= c.generic;
  }

  var api = { parse: parse, cmc: cmc, canPay: canPay, pay: pay, produces: produces, canTapFor: canTapFor, emptyPool: emptyPool };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MTGMana = api;
  return api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));

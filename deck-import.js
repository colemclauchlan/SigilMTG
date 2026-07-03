/*
 * deck-import.js — decklist parsing + Scryfall→card-def mapping. PURE.
 * Browser global (window.MTGDeckImport) + Node module. Two jobs, both pure and offline:
 *   parseDecklist(text)        -> [ { count, name }, … ]   (Moxfield / Arena / plain formats)
 *   cardDefFromScryfall(card)  -> a card-def for card-defs (types, subtypes, colors, P/T, mana, produces)
 *
 * This is the §10-independent half of "real cards": it turns a pasted list + Scryfall's printed data
 * into the characteristics the engine's layer system / combat / mana / targeting already understand —
 * enough to run ANY vanilla creature or land, not just the curated set. Deriving card *behavior*
 * (triggers, activated abilities) from oracle text is the separate, deferred parsing problem; here we
 * only map printed characteristics. The network fetch of Scryfall data is the caller's concern.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGDeckImport = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BASIC_PRODUCES = { plains: "W", island: "U", swamp: "B", mountain: "R", forest: "G", wastes: "C" };
  var SECTION = /^(deck|sideboard|commander|companion|maybeboard|tokens?)\b/i;
  var SUPERTYPES = ["legendary", "basic", "snow", "world", "ongoing", "host", "elite"];

  // strip a trailing "(SET) 123" / "[SET]" / collector number from a card name
  function cleanName(s) {
    return String(s).replace(/\s*[\(\[][^\)\]]*[\)\]]\s*[\dA-Za-z]*\s*$/, "").replace(/\s+\d+\s*$/, "").trim();
  }

  function parseDecklist(text) {
    var out = [], lines = String(text || "").split(/\r?\n/), skip = false;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln || /^(\/\/|#)/.test(ln)) continue;
      if (SECTION.test(ln) && !/^\d/.test(ln)) {               // a section header, not "1 Sideboard..."
        skip = /^(maybeboard|tokens?)\b/i.test(ln);            // drop everything under maybeboard/tokens (sideboard cards are kept)
        continue;
      }
      if (skip) continue;
      var m = ln.match(/^(\d+)\s*[xX]?\s+(.+)$/);
      if (!m) { out.push({ count: 1, name: cleanName(ln) }); continue; }
      out.push({ count: parseInt(m[1], 10), name: cleanName(m[2]) });
    }
    return out;
  }

  function parseManaCost(mc) {
    var cost = {}; if (!mc) return cost;
    (String(mc).match(/\{[^}]+\}/g) || []).forEach(function (sym) {
      var s = sym.slice(1, -1);
      if (/^\d+$/.test(s)) cost.generic = (cost.generic || 0) + parseInt(s, 10);
      else if (/^[WUBRGC]$/.test(s)) cost[s] = (cost[s] || 0) + 1;
      else if (s === "X") { /* X treated as 0 at cast time */ }
      else { (cost.other = cost.other || []).push(s); } // hybrid / Phyrexian — deferred
    });
    return cost;
  }

  function parseTypeLine(tl) {
    var res = { types: [], subtypes: [], supertypes: [] };
    if (!tl) return res;
    var parts = String(tl).split(/[—\-]/);
    (parts[0] || "").trim().toLowerCase().split(/\s+/).forEach(function (w) {
      if (!w) return;
      if (SUPERTYPES.indexOf(w) >= 0) res.supertypes.push(w); else res.types.push(w);
    });
    if (parts[1]) res.subtypes = parts[1].trim().toLowerCase().split(/\s+/).filter(Boolean);
    return res;
  }

  function cardDefFromScryfall(card) {
    card = card || {};
    var tl = parseTypeLine(card.type_line);
    var def = { name: card.name, types: tl.types, subtypes: tl.subtypes, supertypes: tl.supertypes, colors: (card.colors || []).slice() };
    if (card.power != null && card.power !== "") def.power = parseInt(card.power, 10) || 0;
    if (card.toughness != null && card.toughness !== "") def.toughness = parseInt(card.toughness, 10) || 0;
    var cost = parseManaCost(card.mana_cost);
    if (Object.keys(cost).length) def.mana = cost;
    if (tl.types.indexOf("land") >= 0) {
      for (var i = 0; i < tl.subtypes.length; i++) { var p = BASIC_PRODUCES[tl.subtypes[i]]; if (p) { def.produces = p; break; } }
    }
    return def;
  }

  return { parseDecklist: parseDecklist, cleanName: cleanName, parseManaCost: parseManaCost, parseTypeLine: parseTypeLine, cardDefFromScryfall: cardDefFromScryfall, BASIC_PRODUCES: BASIC_PRODUCES };
});

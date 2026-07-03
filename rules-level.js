/*
 * rules-level.js — level up (CR 702.87) & class levels. PURE.
 * Browser global (window.MTGRulesLevel) + Node module. A leveler gains level counters (pay its level-up
 * cost at sorcery speed) and its characteristics change at level thresholds ("level bands"). Class
 * enchantments work the same way with level counters. This selects the active band from the level count
 * and returns its P/T + abilities; compose with rules-layers for counters/anthems on top.
 *
 *   def.levelUp = { generic:1 }     // the level-up cost (paid by the caller)
 *   def.levels  = [ { min:0, max:1, power:2, toughness:2, abilities:[] },
 *                   { min:2, max:4, power:4, toughness:4, abilities:["flying"] },
 *                   { min:5,        power:6, toughness:6, abilities:["flying","trample"] } ]
 *
 *   level(game, id)                 -> current level counters
 *   currentBand(def, level)         -> the active level band
 *   effectiveLevel(game, id, ctx)   -> { power, toughness, abilities } at the current level
 *   levelUpEvents(id)               -> [add a level counter]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesLevel = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function level(game, id) { var c = game.cards[id]; return (c && c.counters && c.counters.level) || 0; }

  function currentBand(def, lvl) {
    var bands = (def && def.levels) || [], best = null;
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (lvl >= (b.min || 0) && (b.max == null || lvl <= b.max)) { if (!best || (b.min || 0) >= (best.min || 0)) best = b; }
    }
    return best || bands[0] || null;
  }

  function effectiveLevel(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id]; if (!c) return null;
    var def = Cards && Cards.get(c.name), b = currentBand(def, level(game, id)); if (!b) return null;
    return { power: b.power, toughness: b.toughness, abilities: (b.abilities || []).slice(), level: level(game, id) };
  }

  function levelUpEvents(id) { return [{ t: "card_counter", instanceId: id, kind: "level", delta: 1 }]; }

  return { level: level, currentBand: currentBand, effectiveLevel: effectiveLevel, levelUpEvents: levelUpEvents };
});

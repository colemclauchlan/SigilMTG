/*
 * rules-protection.js — protection from [color] (CR 702.16). PURE.
 * Browser global (window.MTGRulesProtection) + Node module. Protection is "DEBT": can't be Damaged,
 * Enchanted/Equipped, Blocked, or Targeted by sources of the named quality. This module implements the
 * color slice over EFFECTIVE creatures (so GRANTED protection counts) and the three pure, composable
 * checks the rest of the engine needs:
 *   - can't be BLOCKED by a creature of that color   -> canBeBlockedBy / filterProtectedBlocks
 *   - can't be TARGETED by a source of that color     -> canBeTargetedBy
 *   - DAMAGE from that color is prevented             -> preventsDamageFrom
 * Abilities are strings like "protection from red"; an explicit `protections:["R",…]` is also honored.
 * (Equip/enchant restriction + full combat damage-prevention wiring are deferred & documented.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesProtection = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  var WORD = { white: "W", blue: "U", black: "B", red: "R", green: "G", colorless: "C" };

  // colors a creature has protection from, from ability strings + an optional protections[] list
  function protectionColors(eff) {
    var out = {}, abil = (eff && eff.abilities) || [];
    abil.forEach(function (a) { var m = /^protection from (\w+)$/.exec(String(a).toLowerCase()); if (m && WORD[m[1]]) out[WORD[m[1]]] = true; });
    ((eff && eff.protections) || []).forEach(function (c) { out[c] = true; });
    return Object.keys(out);
  }
  function shares(a, b) { for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) return true; return false; }

  // a creature can't be blocked by a blocker whose color it's protected from
  function canBeBlockedBy(attackerEff, blockerEff) {
    return !shares(protectionColors(attackerEff), (blockerEff && blockerEff.colors) || []);
  }
  // a permanent can't be targeted by a source of a color it's protected from
  function canBeTargetedBy(targetEff, sourceColors) {
    return !shares(protectionColors(targetEff), sourceColors || []);
  }
  // damage from a source of a protected-from color is prevented
  function preventsDamageFrom(eff, sourceColors) {
    return shares(protectionColors(eff), sourceColors || []);
  }

  // effective {colors, abilities} for a creature on the board (granted keywords via rules-keywords)
  function analyze(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return { colors: [], abilities: [] };
    var def = Cards && Cards.get(c.name);
    // prefer the attachment-aware effective state so equipment/aura-granted "protection from …" counts
    var abilities = (At && At.effectiveAttached && At.effectiveAttached(game, id, ctx).abilities)
      || (KW && KW.effectiveFull && KW.effectiveFull(game, id, ctx).abilities)
      || (def && def.abilities) || [];
    return { colors: (def && def.colors) || [], abilities: abilities };
  }

  // strip blocks that are illegal because the attacker is protected from the blocker's color
  function filterProtectedBlocks(game, attackPlan, ctx) {
    return (attackPlan || []).map(function (pair) {
      var atk = analyze(game, pair.attacker, ctx);
      var keep = (pair.blockers || []).filter(function (bid) { return canBeBlockedBy(atk, analyze(game, bid, ctx)); });
      return { attacker: pair.attacker, target: pair.target, blockers: keep };
    });
  }

  return {
    protectionColors: protectionColors, canBeBlockedBy: canBeBlockedBy, canBeTargetedBy: canBeTargetedBy,
    preventsDamageFrom: preventsDamageFrom, analyze: analyze, filterProtectedBlocks: filterProtectedBlocks
  };
});

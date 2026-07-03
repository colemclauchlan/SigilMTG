/*
 * rules-menace.js — menace (CR 702.111) & "can't be blocked" evasion. PURE.
 * Browser global (window.MTGRulesMenace) + Node module. Sits alongside rules-evasion (flying/reach) and
 * adds the block-COUNT / unblockable restrictions, over EFFECTIVE abilities (rules-keywords, so GRANTED
 * menace counts):
 *   - menace            -> can't be blocked except by TWO OR MORE creatures
 *   - "can't be blocked"/"unblockable" -> can't be blocked at all
 * filterEvasion() strips illegal blocks from a declared block plan (an attacker blocked by exactly one
 * creature while it has menace becomes unblocked). Compose it after rules-blocking + rules-evasion.
 * (Skulk / "can't be blocked by one or more" / menace from a specific quality are deferred & documented.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMenace = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }  // equipment/aura-granted keywords count
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }
  function has(ab, kw) { return ab.indexOf(kw) >= 0; }
  function hasMenace(ab) { return has(ab, "menace"); }
  function isUnblockable(ab) { return has(ab, "unblockable") || has(ab, "can't be blocked"); }

  // is a block of `blockerCount` creatures legal for an attacker with these abilities?
  function blockCountLegal(ab, blockerCount) {
    if (blockerCount === 0) return true;                 // being unblocked is always "legal"
    if (isUnblockable(ab)) return false;
    if (hasMenace(ab) && blockerCount < 2) return false; // menace needs two or more
    return true;
  }

  // strip illegal blocks from a declared plan: an under-blocked menace / unblockable attacker goes through
  function filterEvasion(game, attackPlan, ctx) {
    return (attackPlan || []).map(function (pair) {
      var ab = abilitiesOf(game, pair.attacker, ctx), blockers = pair.blockers || [];
      var legal = blockCountLegal(ab, blockers.length) ? blockers : [];
      return { attacker: pair.attacker, target: pair.target, blockers: legal };
    });
  }

  return { abilitiesOf: abilitiesOf, hasMenace: hasMenace, isUnblockable: isUnblockable, blockCountLegal: blockCountLegal, filterEvasion: filterEvasion };
});

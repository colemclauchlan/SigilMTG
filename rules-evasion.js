/*
 * rules-evasion.js — block legality / evasion (flying, reach). PURE.
 * Browser global (window.MTGRulesEvasion) + Node module. Decides which creatures may legally block an
 * attacker (CR 509.1b): a creature with flying can only be blocked by creatures with flying or reach.
 * Provides canBlock(attacker, blocker), legalBlockerIds(...), and filterLegalBlocks(plan) to strip
 * illegal blocker assignments from an attack plan (compose it after a blocking AI's choices).
 * Uses EFFECTIVE creatures (rules-keywords / rules-layers) so granted keywords count. Read-only.
 *
 * Modeled: flying / reach. Deferred (documented): menace (needs 2+ blockers), fear/intimidate,
 * shadow, horsemanship, protection, "can't be blocked".
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesEvasion = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function kw(c, k) { return c && (c.abilities || []).indexOf(k) >= 0; }

  function eff(game, id, ctx) {
    var KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e) { e.id = id; return e; } }
    var Cards = pick(ctx, "Cards", "MTGCards"), Layers = pick(ctx, "Layers", "MTGRulesLayers"), c = game.cards[id];
    if (!c) return null; var def = Cards ? Cards.get(c.name) : null; if (!def || def.power == null) return null;
    var x = Layers.computeEffectiveState(Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat }), []); x.id = id; return x;
  }

  // can `blocker` legally block `attacker`? (both effective creatures)
  function canBlock(attacker, blocker) {
    if (kw(attacker, "flying") && !(kw(blocker, "flying") || kw(blocker, "reach"))) return false;
    return true;
  }

  function legalBlockerIds(game, attackerId, defenderSeat, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), atk = eff(game, attackerId, ctx);
    if (!atk) return [];
    return Core.cardsOf(game, defenderSeat, "battlefield")
      .filter(function (c) { return !c.tapped; })
      .filter(function (c) { var b = eff(game, c.instanceId, ctx); return b && canBlock(atk, b); })
      .map(function (c) { return c.instanceId; });
  }

  // strip illegal blocker assignments from an attack plan
  function filterLegalBlocks(game, attackPlan, ctx) {
    return (attackPlan || []).map(function (pair) {
      var atk = eff(game, pair.attacker, ctx);
      var legal = (pair.blockers || []).filter(function (bid) { var b = eff(game, bid, ctx); return b && atk && canBlock(atk, b); });
      return { attacker: pair.attacker, blockers: legal };
    });
  }

  return { canBlock: canBlock, legalBlockerIds: legalBlockerIds, filterLegalBlocks: filterLegalBlocks, effective: eff };
});

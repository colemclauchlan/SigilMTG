/*
 * rules-indestructible.js — indestructible (CR 702.12). PURE.
 * Browser global (window.MTGRulesIndestructible) + Node module. An indestructible permanent isn't
 * destroyed by lethal damage or by "destroy" effects (and deathtouch's lethality doesn't matter). Works
 * over EFFECTIVE abilities (rules-keywords, so GRANTED indestructible counts) and composes with combat
 * and removal:
 *   - survivesLethal(eff)              -> true if it shrugs off lethal damage / deathtouch
 *   - filterDestroy(game, ids, ctx)    -> of the creatures a "destroy" would hit, which ACTUALLY die
 *   - survivesCombat(game, id, dmg, deathtouch, ctx) -> does it live through this combat damage?
 * (Note: indestructible does NOT stop −X/−X to 0 toughness, sacrifice, exile, or 0-loyalty — those are
 * not "destruction"; SBA toughness≤0 still applies and is handled by rules-sba.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesIndestructible = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }  // equipment/aura-granted keywords count (e.g. Darksteel Plate)
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }
  function hasIndestructible(ab) { return ab.indexOf("indestructible") >= 0; }

  // from an effective-creature object {abilities}: does it survive lethal damage / a destroy?
  function survivesLethal(eff) { return hasIndestructible((eff && eff.abilities) || []); }

  function isIndestructible(game, id, ctx) { return hasIndestructible(abilitiesOf(game, id, ctx)); }

  // which of these creatures actually die to a "destroy" effect (the indestructible ones don't)
  function filterDestroy(game, ids, ctx) {
    return (ids || []).filter(function (id) { return !isIndestructible(game, id, ctx); });
  }

  // does a creature survive `dmg` combat damage (deathtouch or not)? indestructible always survives;
  // otherwise lethal = toughness reached, or any damage from deathtouch
  function survivesCombat(game, id, dmg, deathtouch, ctx) {
    if (isIndestructible(game, id, ctx)) return true;
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    var eff = (KW && KW.effectiveFull) ? KW.effectiveFull(game, id, ctx) : null;
    var tough = eff ? eff.toughness : (Cards && Cards.get(game.cards[id].name) || {}).toughness;
    if (deathtouch && dmg > 0) return false;
    return !(tough != null && dmg >= tough);
  }

  return { survivesLethal: survivesLethal, isIndestructible: isIndestructible, filterDestroy: filterDestroy, survivesCombat: survivesCombat };
});

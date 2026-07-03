/*
 * rules-soulbond.js — soulbond (CR 702.97). PURE.
 * Browser global (window.MTGRulesSoulbond) + Node module. "You may pair this creature with another
 * unpaired creature when either enters; they remain paired as long as you control both." While paired,
 * each member has a shared keyword (e.g. Trygon Predator-style pairs grant flying, lifelink, …). We model
 * the pairing as a mutual `soulbondPartner` link stored on each card, and a `soulbondKeyword` describing
 * the granted ability. `effectiveKeywords` returns a card's printed abilities PLUS the shared keyword while
 * it is paired (the keyword applies to BOTH the source and its partner).
 *
 * A creature may only be paired with ONE other at a time, and only if BOTH are currently unpaired.
 * When a paired creature leaves (dies / changes zones / loses control), the pair breaks for both.
 *
 *   isPaired(game, id) / partnerOf(game, id)            -> pairing state
 *   pair(game, aId, bId, keyword?)                      -> mutate game: link a<->b (no-op if either paired). returns bool
 *   unpairOnLeave(game, id)                             -> mutate game: break id's pairing on both sides. returns bool
 *   effectiveKeywords(game, id, ctx)                    -> [keywords] incl. the shared keyword while paired
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSoulbond = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function partnerOf(game, id) { var c = game.cards[id]; return c ? (c.soulbondPartner != null ? c.soulbondPartner : null) : null; }
  function isPaired(game, id) { return partnerOf(game, id) != null; }

  function baseAbilities(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    var c = game.cards[id]; if (!c) return [];
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e && e.abilities) return e.abilities.slice(); }
    var def = Cards && Cards.get(c.name); return def ? (def.abilities || []).slice() : [];
  }

  // Pair two unpaired creatures; store the shared keyword on both. Returns false if either is already paired.
  function pair(game, aId, bId, keyword) {
    var a = game.cards[aId], b = game.cards[bId];
    if (!a || !b || aId === bId) return false;
    if (isPaired(game, aId) || isPaired(game, bId)) return false;
    a.soulbondPartner = bId; b.soulbondPartner = aId;
    if (keyword != null) { a.soulbondKeyword = keyword; b.soulbondKeyword = keyword; }
    return true;
  }

  // Break the pairing when `id` leaves: clear it on `id` and on its (former) partner.
  function unpairOnLeave(game, id) {
    var c = game.cards[id]; if (!c || !isPaired(game, id)) return false;
    var pid = c.soulbondPartner, p = game.cards[pid];
    delete c.soulbondPartner; delete c.soulbondKeyword;
    if (p && p.soulbondPartner === id) { delete p.soulbondPartner; delete p.soulbondKeyword; }
    return true;
  }

  // Printed/effective abilities + the shared soulbond keyword while this creature is paired.
  function effectiveKeywords(game, id, ctx) {
    var ab = baseAbilities(game, id, ctx);
    var c = game.cards[id];
    if (c && isPaired(game, id) && c.soulbondKeyword) {
      if (ab.indexOf(c.soulbondKeyword) < 0) ab = ab.concat([c.soulbondKeyword]);
    }
    return ab;
  }

  return {
    pick: pick, partnerOf: partnerOf, isPaired: isPaired,
    pair: pair, unpairOnLeave: unpairOnLeave, effectiveKeywords: effectiveKeywords
  };
});

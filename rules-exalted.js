/*
 * rules-exalted.js — exalted (CR 702.83). PURE.
 * Browser global (window.MTGRulesExalted) + Node module. "Whenever a creature you control attacks ALONE,
 * that creature gets +1/+1 until end of turn." Exalted stacks: each separate exalted ability among a
 * player's permanents triggers, so a creature attacking alone gets +1/+1 for EACH exalted instance the
 * attacking player controls (and exalted does not require the boosted creature itself to have exalted —
 * the buff comes from the controller's permanents). The bonus applies only when EXACTLY ONE creature is
 * declared as an attacker that combat.
 *
 *   exaltedCount(game, seat, ctx)                       -> number of exalted instances among seat's permanents
 *   exaltedBonus(game, seat, attackerIds, ctx)          -> { power, toughness } added to the lone attacker
 *
 * Honors GRANTED exalted (a permanent granted "exalted" via static/aura/equipment counts as an instance).
 * "Attacks alone" = a creature is the only attacker (its controller declared exactly one). Multi-instance
 * stacking matches Rafiq / Sublime Archangel style boards.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesExalted = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  // effective ability list of a card, honoring granted keywords
  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }

  // number of exalted ability instances among the permanents a seat controls
  function exaltedCount(game, seat, ctx) {
    var n = 0;
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.zone !== "battlefield" || c.controllerSeat !== seat) continue;
      var ab = abilitiesOf(game, id, ctx);
      for (var i = 0; i < ab.length; i++) if (ab[i] === "exalted") n++; // a permanent may list exalted more than once
    }
    return n;
  }

  // bonus applied to the lone attacker: +1/+1 per exalted instance, ONLY when exactly one attacker
  function exaltedBonus(game, seat, attackerIds, ctx) {
    var attackers = attackerIds || [];
    if (attackers.length !== 1) return { power: 0, toughness: 0 };
    var n = exaltedCount(game, seat, ctx);
    return { power: n, toughness: n };
  }

  return { abilitiesOf: abilitiesOf, exaltedCount: exaltedCount, exaltedBonus: exaltedBonus };
});

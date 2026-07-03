/*
 * rules-toxic.js — toxic N (CR 702.180). PURE.
 * Browser global (window.MTGRulesToxic) + Node module. "Toxic N" means: in addition to a creature's
 * combat damage being dealt to a player as NORMAL (the player still loses that much life), that player
 * also gets N poison counters. Unlike infect, the damage is real life loss — toxic only ADDS poison.
 * This module produces ONLY the poison-counter events; it never touches life. Compose its events with
 * the existing combat-damage application (which still applies the life loss). Works over EFFECTIVE
 * abilities (rules-keywords) so GRANTED toxic counts.
 *
 *   toxicN(game, attackerId, ctx)                          -> total N from all toxic abilities on the creature
 *   poisonOnDamageToPlayer(game, attackerId, defenderSeat, ctx) -> [ player_counter poison events ] (or [])
 *
 * Toxic is read from effective abilities as either "toxic" (=> N 1) or "toxic N" / {kw:"toxic",n:N};
 * multiple toxic abilities add together (CR 702.180e). N 0 / no toxic / no defender => no events.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesToxic = mod;
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

  // parse the N out of one ability entry: "toxic" => 1, "toxic 3" => 3, {kw:"toxic",n:3} => 3, else 0
  function toxicValue(ab) {
    if (ab && typeof ab === "object") {
      if (ab.kw === "toxic" || ab.keyword === "toxic") return ab.n != null ? (ab.n | 0) : 1;
      return 0;
    }
    if (typeof ab !== "string") return 0;
    if (ab === "toxic") return 1;
    var m = /^toxic\s+(\d+)$/.exec(ab);
    return m ? (parseInt(m[1], 10) || 0) : 0;
  }

  // sum N over every toxic ability the creature effectively has (multiple toxics add)
  function toxicN(game, attackerId, ctx) {
    var ab = abilitiesOf(game, attackerId, ctx), n = 0;
    for (var i = 0; i < ab.length; i++) n += toxicValue(ab[i]);
    return n;
  }

  // poison events for combat damage to a player; does NOT alter life loss (compose alongside it)
  function poisonOnDamageToPlayer(game, attackerId, defenderSeat, ctx) {
    if (defenderSeat == null) return [];
    var n = toxicN(game, attackerId, ctx);
    if (!(n > 0)) return [];
    return [{ t: "player_counter", seat: defenderSeat, kind: "poison", delta: n }];
  }

  return { toxicN: toxicN, poisonOnDamageToPlayer: poisonOnDamageToPlayer, toxicValue: toxicValue };
});

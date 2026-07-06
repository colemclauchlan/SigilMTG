/*
 * rules-casualty.js — casualty N (CR 702.152). PURE.
 * Browser global (window.MTGRulesCasualty) + Node module. "As you cast this spell, you may sacrifice a
 * creature with power N or greater. When you do, copy this spell." This module owns the N value, the check
 * that a chosen creature qualifies, and the events (sacrifice the creature + flag the spell so the resolver
 * makes a copy). The copy itself is an engine action; this flags that it should happen.
 *
 *   def.casualty = 2
 *
 *   casualtyN(def)                                     -> N, or null
 *   effectivePower(game, cardId, ctx)                   -> base power + (+1/+1) − (−1/−1) counters
 *   canCasualty(game, spellId, seat, sacId, ctx)        -> { ok, reason }
 *   casualtyEvents(game, spellId, sacId, ctx)           -> [sacrifice sacId→graveyard, __set casualtyPaid]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesCasualty = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function casualtyN(def) { return (def && def.casualty != null) ? def.casualty : null; }

  function effectivePower(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return 0;
    var def = Cards && Cards.get(c.name), base = (def && def.power) || 0, ctr = c.counters || {};
    return base + (ctr["+1/+1"] || 0) - (ctr["-1/-1"] || 0);
  }

  function canCasualty(game, spellId, seat, sacId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var spell = game.cards[spellId];
    if (!spell) return { ok: false, reason: "no spell" };
    if (owner(spell) !== seat) return { ok: false, reason: "not your spell" };
    var n = casualtyN(Cards && Cards.get(spell.name));
    if (n == null) return { ok: false, reason: "no casualty" };
    var sac = game.cards[sacId];
    if (!sac || sac.zone !== "battlefield" || owner(sac) !== seat || !isCreature(Cards && Cards.get(sac.name))) return { ok: false, reason: "sacrifice a creature you control" };
    if (effectivePower(game, sacId, ctx) < n) return { ok: false, reason: "that creature's power is less than " + n };
    return { ok: true };
  }

  // sacrifice the chosen creature and flag the spell so it gets copied on resolution
  function casualtyEvents(game, spellId, sacId, ctx) {
    var sac = game.cards[sacId], spell = game.cards[spellId];
    if (!sac || !spell) return [];
    return [
      { t: "card_move", instanceId: sacId, toZone: "graveyard" },
      { t: "__set", cards: [{ id: spellId, fields: { casualtyPaid: true } }] }
    ];
  }

  return { casualtyN: casualtyN, effectivePower: effectivePower, canCasualty: canCasualty, casualtyEvents: casualtyEvents };
});

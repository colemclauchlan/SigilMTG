/*
 * rules-flashback.js — flashback (CR 702.34). PURE.
 * Browser global (window.MTGRulesFlashback) + Node module. "You may cast this card from your graveyard by
 * paying its flashback cost rather than its mana cost. Then exile it." Composes the graveyard + mana
 * systems: validate, pay the FLASHBACK cost, move graveyard → stack with a flag so resolution exiles it
 * (instead of the usual graveyard). The spell's own effects come from its `spell` (rules-spells).
 *
 *   def.flashback = { generic:2, R:1 }     // the alternative cost
 *
 *   canFlashback(game, cardId, seat, ctx)  -> { ok, reason }
 *   flashbackEvents(game, cardId, ctx)     -> [pay flashback cost, move → stack, mark flashbackCast]
 *   resolveExile(game, cardId)             -> [card_move → exile] for a flashback-cast spell (else [])
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesFlashback = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function flashbackCost(def) { return (def && def.flashback) || null; }

  function canFlashback(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "graveyard") return { ok: false, reason: "card is not in the graveyard" };
    if (c.ownerSeat !== seat) return { ok: false, reason: "not your card" };
    var def = Cards && Cards.get(c.name), fb = flashbackCost(def);
    if (!fb) return { ok: false, reason: "no flashback" };
    if (Mana && !Mana.canPay(fb, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the flashback cost" };
    return { ok: true };
  }

  function flashbackEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId], def = Cards && Cards.get(c.name), seat = c.ownerSeat, fb = flashbackCost(def), events = [];
    if (fb && Mana) {
      var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(fb, pool) || pool, colors = {};
      Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
      Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    }
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { flashbackCast: true } }] });
    return events;
  }

  // a flashback-cast spell is EXILED as it would leave the stack (not put into the graveyard)
  function resolveExile(game, cardId) {
    var c = game.cards[cardId];
    return c && c.flashbackCast ? [{ t: "card_move", instanceId: cardId, toZone: "exile" }] : [];
  }

  return { flashbackCost: flashbackCost, canFlashback: canFlashback, flashbackEvents: flashbackEvents, resolveExile: resolveExile };
});

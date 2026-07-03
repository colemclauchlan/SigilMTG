/*
 * rules-escape.js — escape (CR 702.139). PURE.
 * Browser global (window.MTGRulesEscape) + Node module. "Escape — [mana cost], Exile N other cards from
 * your graveyard. You may cast this card from your graveyard for its escape cost." Composes the graveyard +
 * mana systems, with EXILING other graveyard cards as part of the cost.
 *
 *   def.escape = { mana:{generic:2,B:1}, exile:3 }   // escape cost: pay the mana AND exile 3 others
 *
 *   escapeCost(def)                                  -> { mana, exile } or null
 *   canEscape(game, cardId, seat, ctx)                -> { ok, reason }
 *   escapeEvents(game, cardId, exileIds, ctx)         -> [pay mana, exile the chosen others, card → stack]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesEscape = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function escapeCost(def) { return (def && def.escape) || null; }

  function canEscape(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana"), Core = pick(ctx, "Core", "MTGCore");
    var c = game.cards[cardId];
    if (!c || c.zone !== "graveyard") return { ok: false, reason: "card is not in your graveyard" };
    if (c.ownerSeat !== seat) return { ok: false, reason: "not your card" };
    var esc = escapeCost(Cards && Cards.get(c.name));
    if (!esc) return { ok: false, reason: "no escape" };
    var others = Core ? Core.cardsOf(game, seat, "graveyard").filter(function (g) { return g.instanceId !== cardId; }).length : 0;
    if (others < (esc.exile || 0)) return { ok: false, reason: "not enough other cards in the graveyard to exile" };
    if (esc.mana && Mana && !Mana.canPay(esc.mana, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the escape mana" };
    return { ok: true };
  }

  function escapeEvents(game, cardId, exileIds, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId], seat = c.ownerSeat, esc = escapeCost(Cards && Cards.get(c.name)), events = [];
    if (esc && esc.mana && Mana) {
      var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(esc.mana, pool) || pool, colors = {};
      Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
      Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    }
    (exileIds || []).forEach(function (id) { if (id !== cardId) events.push({ t: "card_move", instanceId: id, toZone: "exile" }); });  // exile the others (the cost)
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });                                                            // cast it
    return events;
  }

  return { escapeCost: escapeCost, canEscape: canEscape, escapeEvents: escapeEvents };
});

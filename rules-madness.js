/*
 * rules-madness.js — madness (CR 702.35). PURE.
 * Browser global (window.MTGRulesMadness) + Node module. "If you discard this card, exile it instead of
 * putting it into your graveyard. When you do, you may cast it by paying its madness cost rather than
 * putting it into your graveyard." Models the replacement (discard → exile) and the choice that follows:
 * cast it for the madness cost, or let it fall to the graveyard. Composes the mana + zone systems as events.
 *
 *   def.madness = { generic:1, R:1 }       // the madness cost
 *
 *   madnessCost(def)                       -> the cost, or null
 *   onDiscard(game, cardId, ctx)           -> { canMadness, cost, events:[move → exile, mark madness] }
 *   castMadness(game, cardId, ctx)         -> [pay madness cost, move exile → stack, clear madness flag]
 *   declineMadness(game, cardId, ctx)      -> [move exile → graveyard, clear madness flag]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMadness = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function madnessCost(def) { return (def && def.madness) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  // discarding a madness card exiles it instead (with a flag) — the trigger then offers to cast it
  function onDiscard(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId], cost = madnessCost(Cards && Cards.get(c && c.name));
    if (!cost) {
      // no madness — an ordinary discard goes to the graveyard
      return { canMadness: false, cost: null, events: [{ t: "card_move", instanceId: cardId, toZone: "graveyard" }] };
    }
    return {
      canMadness: true, cost: cost,
      events: [
        { t: "card_move", instanceId: cardId, toZone: "exile" },
        { t: "__set", cards: [{ id: cardId, fields: { madness: true } }] }
      ]
    };
  }

  function castMadness(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId];
    if (!c || !c.madness) return [];
    var cost = madnessCost(Cards && Cards.get(c.name)), seat = c.ownerSeat;
    var events = payEvents(game, seat, cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { madness: false } }] });
    return events;
  }

  // declining (or being unable to pay) puts the exiled madness card into the graveyard
  function declineMadness(game, cardId, ctx) {
    var c = game.cards[cardId];
    if (!c || !c.madness) return [];
    return [
      { t: "card_move", instanceId: cardId, toZone: "graveyard" },
      { t: "__set", cards: [{ id: cardId, fields: { madness: false } }] }
    ];
  }

  return { madnessCost: madnessCost, onDiscard: onDiscard, castMadness: castMadness, declineMadness: declineMadness };
});

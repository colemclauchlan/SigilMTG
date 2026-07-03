/*
 * rules-plot.js — plot (CR 702.168). PURE.
 * Browser global (window.MTGRulesPlot) + Node module. "You may pay [plot cost] and exile this card from
 * your hand. Cast it as a sorcery on a later turn without paying its mana cost." Plotting is a two-step
 * mechanic: (1) exile the card face-up from hand for the plot cost, tagging it `plotted` with the turn it
 * was plotted; (2) on a LATER turn, during your main phase, cast it from exile for free. You can't plot and
 * cast the same turn. This module gives the plot-exile events, the "may I cast it now" check, and the
 * free-cast events (exile → stack).
 *
 *   def.plot = { generic:2, R:1 }     // the plot cost paid to exile it
 *
 *   plotCost(def)                              -> the plot cost, or null
 *   canPlot(game, cardId, seat, ctx)           -> { ok, reason }        (in hand, yours, has plot, can pay)
 *   plotEvents(game, cardId, turn, ctx)        -> [pay…, exile, __set plotted+plottedTurn]
 *   canCastPlotted(game, cardId, seat, turn)   -> { ok, reason }        (later turn than plottedTurn)
 *   castPlottedEvents(game, cardId)            -> [card_move exile→stack]  (free cast)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesPlot = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function plotCost(def) { return (def && def.plot) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canPlot(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "you plot a card from your hand" };
    if ((c.ownerSeat != null ? c.ownerSeat : c.controllerSeat) !== seat) return { ok: false, reason: "not your card" };
    var cost = plotCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no plot cost" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the plot cost" };
    return { ok: true };
  }

  // exile the card face-up for its plot cost, remembering the turn it was plotted
  function plotEvents(game, cardId, turn, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var seat = c.ownerSeat != null ? c.ownerSeat : c.controllerSeat;
    var events = payEvents(game, seat, plotCost(Cards && Cards.get(c.name)), ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "exile" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { plotted: true, plottedTurn: turn } }] });
    return events;
  }

  // may this plotted card be cast now? — it must be a LATER turn than the one it was plotted on
  function canCastPlotted(game, cardId, seat, turn) {
    var c = game.cards[cardId];
    if (!c || !c.plotted || c.zone !== "exile") return { ok: false, reason: "card is not plotted in exile" };
    if ((c.ownerSeat != null ? c.ownerSeat : c.controllerSeat) !== seat) return { ok: false, reason: "not your card" };
    if (c.plottedTurn != null && turn != null && turn <= c.plottedTurn) return { ok: false, reason: "can't cast a plotted card the turn you plotted it" };
    return { ok: true };
  }

  // cast the plotted card for free: move it from exile to the stack
  function castPlottedEvents(game, cardId) {
    var c = game.cards[cardId];
    if (!c || !c.plotted) return [];
    return [{ t: "card_move", instanceId: cardId, toZone: "stack" }];
  }

  return { plotCost: plotCost, canPlot: canPlot, plotEvents: plotEvents, canCastPlotted: canCastPlotted, castPlottedEvents: castPlottedEvents };
});

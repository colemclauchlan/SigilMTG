/*
 * rules-saga.js — Sagas (CR 714). PURE.
 * Browser global (window.MTGRulesSaga) + Node module. A Saga enters with no lore counters; as it enters and
 * after your draw step each turn you put a lore counter on it, and when it reaches the number of a chapter,
 * that chapter ability triggers; after the final chapter resolves the Saga is sacrificed.
 *
 *   def (saga) = { types:["enchantment","saga"], chapters:[ {effects:[…]}, {effects:[…]}, {effects:[…]} ] }
 *
 *   lore(game, id)                 -> current lore counters
 *   advance(game, id, ctx)         -> { events:[add a lore counter], chapter:N, effects:[…bound…], isFinal }
 *   sacrificeIfDone(game, id, ctx) -> [card_move → graveyard] once the last chapter is reached
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSaga = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function chaptersOf(def) { return (def && def.chapters) || []; }
  function lore(game, id) { var c = game.cards[id]; return (c && c.counters && c.counters.lore) || 0; }

  function bind(effects, card, target) {
    return (effects || []).map(function (e) {
      var o = {}; for (var k in e) o[k] = e[k];
      if (o.seat === "controller" && card) o.seat = card.controllerSeat;
      else if (o.seat === "owner" && card) o.seat = card.ownerSeat;
      else if (o.seat === "target" && target && target.kind === "player") o.seat = target.seat;
      if (o.instanceId === "target" && target && target.kind === "card") o.instanceId = target.instanceId;
      return o;
    });
  }

  // put a lore counter on; the chapter whose number is now reached triggers
  function advance(game, id, ctx, target) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    var def = Cards && Cards.get(c.name), chapters = chaptersOf(def), next = lore(game, id) + 1;
    var ch = chapters[next - 1];
    return {
      events: [{ t: "card_counter", instanceId: id, kind: "lore", delta: 1 }],
      chapter: next,
      effects: ch ? bind(ch.effects, c, target) : [],
      isFinal: next >= chapters.length
    };
  }

  function sacrificeIfDone(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    var def = Cards && Cards.get(c.name), chapters = chaptersOf(def);
    return lore(game, id) >= chapters.length && chapters.length ? [{ t: "card_move", instanceId: id, toZone: "graveyard" }] : [];
  }

  return { lore: lore, chaptersOf: chaptersOf, advance: advance, sacrificeIfDone: sacrificeIfDone };
});

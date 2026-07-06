/*
 * rules-manifest.js — manifest (CR 701.34). PURE.
 * Browser global (window.MTGRulesManifest) + Node module. "To manifest a card, put it onto the battlefield
 * face down as a 2/2 creature. Its controller may turn it face up at any time for its mana cost if it's a
 * creature card." This module manifests the top card of the library and handles turning a manifested card
 * face up (only creature cards, paying their mana cost).
 *
 *   manifestTopEvents(game, seat, ctx)             -> [top library card → battlefield, __set faceDown+manifested]
 *   canTurnUp(game, cardId, seat, ctx)             -> { ok, reason }   (manifested, creature card, mana payable)
 *   turnUpEvents(game, cardId, ctx)                -> [pay mana…, __set faceDown:false, manifested:false]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesManifest = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  // manifest the top card of your library: onto the battlefield face-down as a 2/2
  function manifestTopEvents(game, seat, ctx) {
    var Core = pick(ctx, "Core", "MTGCore");
    var lib = Core ? Core.cardsOf(game, seat, "library") : [];
    if (!lib.length) return [];
    var id = lib[0].instanceId;
    return [
      { t: "card_move", instanceId: id, toZone: "battlefield" },
      { t: "__set", cards: [{ id: id, fields: { faceDown: true, manifested: true } }] }
    ];
  }

  function canTurnUp(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || !c.manifested || c.zone !== "battlefield") return { ok: false, reason: "not a manifested permanent" };
    if (owner(c) !== seat) return { ok: false, reason: "not your permanent" };
    var def = Cards && Cards.get(c.name);
    if (!isCreature(def)) return { ok: false, reason: "only a creature card can be turned face up" };
    if (Mana && def.mana && !Mana.canPay(def.mana, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay its mana cost" };
    return { ok: true };
  }

  // turn a manifested creature face up by paying its mana cost
  function turnUpEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c || !c.manifested) return [];
    var def = Cards && Cards.get(c.name);
    var events = payEvents(game, owner(c), def && def.mana, ctx);
    events.push({ t: "__set", cards: [{ id: cardId, fields: { faceDown: false, manifested: false } }] });
    return events;
  }

  return { manifestTopEvents: manifestTopEvents, canTurnUp: canTurnUp, turnUpEvents: turnUpEvents };
});

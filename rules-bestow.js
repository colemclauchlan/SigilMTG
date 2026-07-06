/*
 * rules-bestow.js — bestow (CR 702.103). PURE.
 * Browser global (window.MTGRulesBestow) + Node module. A permanent with bestow is an Aura spell with an
 * enchant-creature target if you cast it for its bestow cost; otherwise it's a normal creature spell. While
 * attached it's an Aura (not a creature); if the enchanted creature leaves, the permanent becomes a creature.
 * This module owns the bestow cost, the two eligibility checks, and events for both cast modes + the
 * "becomes a creature when it falls off" transition.
 *
 *   def.bestow = { generic:2, W:1 }     // the bestow (Aura) cost; def.mana is the normal creature cost
 *
 *   bestowCost(def)                                    -> the bestow cost, or null
 *   canCastAsCreature(game, cardId, seat, ctx)         -> { ok, reason }     (normal creature cast)
 *   canBestow(game, cardId, seat, targetId, ctx)       -> { ok, reason }     (Aura cast onto a creature)
 *   castBestowEvents(game, cardId, targetId, ctx)      -> [pay bestow…, hand→stack, __set bestowed+target]
 *   fallOffEvents(game, cardId)                        -> [__set bestowed:false, attachedTo:null]  (now a creature)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesBestow = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function bestowCost(def) { return (def && def.bestow) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canCastAsCreature(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "cast from your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var def = Cards && Cards.get(c.name);
    if (!isCreature(def)) return { ok: false, reason: "not a creature" };
    if (Mana && def.mana && !Mana.canPay(def.mana, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the creature cost" };
    return { ok: true };
  }

  // cast as an Aura for the bestow cost onto a creature you can enchant
  function canBestow(game, cardId, seat, targetId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "cast from your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var cost = bestowCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no bestow" };
    var tgt = game.cards[targetId];
    if (!tgt || tgt.zone !== "battlefield" || !isCreature(Cards && Cards.get(tgt.name))) return { ok: false, reason: "target must be a creature on the battlefield" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the bestow cost" };
    return { ok: true };
  }

  // cast for the bestow cost: pay it, put it on the stack as an Aura targeting the creature
  function castBestowEvents(game, cardId, targetId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var cost = bestowCost(Cards && Cards.get(c.name)); if (!cost) return [];
    var events = payEvents(game, owner(c), cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { bestowed: true, bestowTarget: targetId } }] });
    return events;
  }

  // the enchanted creature left — a bestowed Aura becomes a creature and stays on the battlefield
  function fallOffEvents(game, cardId) {
    var c = game.cards[cardId];
    if (!c || !c.bestowed) return [];
    return [{ t: "__set", cards: [{ id: cardId, fields: { bestowed: false, bestowTarget: null, attachedTo: null } }] }];
  }

  return { bestowCost: bestowCost, canCastAsCreature: canCastAsCreature, canBestow: canBestow, castBestowEvents: castBestowEvents, fallOffEvents: fallOffEvents };
});

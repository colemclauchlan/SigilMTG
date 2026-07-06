/*
 * rules-scavenge.js — scavenge (CR 702.81). PURE.
 * Browser global (window.MTGRulesScavenge) + Node module. "Scavenge [cost] ([cost], exile this card from
 * your graveyard: put N +1/+1 counters on target creature. Activate only as a sorcery.)" This module owns
 * the cost + N, the eligibility check (card in your graveyard, target creature, cost payable) and the
 * events (pay, exile the card, add N counters).
 *
 *   def.scavenge = { cost:{ generic:3, G:1 }, n:2 }
 *
 *   scavengeInfo(def)                                      -> { cost, n } or null
 *   canScavenge(game, cardId, seat, targetId, ctx)         -> { ok, reason }
 *   scavengeEvents(game, cardId, targetId, ctx)            -> [pay…, card→exile, +N +1/+1 on target]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesScavenge = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function scavengeInfo(def) { return (def && def.scavenge) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canScavenge(game, cardId, seat, targetId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "graveyard") return { ok: false, reason: "scavenge from your graveyard" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var info = scavengeInfo(Cards && Cards.get(c.name));
    if (!info) return { ok: false, reason: "no scavenge" };
    var tgt = game.cards[targetId];
    if (!tgt || tgt.zone !== "battlefield" || !isCreature(Cards && Cards.get(tgt.name))) return { ok: false, reason: "target must be a creature on the battlefield" };
    if (Mana && info.cost && !Mana.canPay(info.cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the scavenge cost" };
    return { ok: true };
  }

  // pay the cost, exile the card from the graveyard, and add N +1/+1 counters to the target
  function scavengeEvents(game, cardId, targetId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var info = scavengeInfo(Cards && Cards.get(c.name)); if (!info) return [];
    var events = payEvents(game, owner(c), info.cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "exile" });
    if (game.cards[targetId] && info.n > 0) events.push({ t: "card_counter", instanceId: targetId, kind: "+1/+1", delta: info.n });
    return events;
  }

  return { scavengeInfo: scavengeInfo, canScavenge: canScavenge, scavengeEvents: scavengeEvents };
});

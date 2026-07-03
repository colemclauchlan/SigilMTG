/*
 * rules-unearth.js — unearth (CR 702.84). PURE (drives engine-core).
 * Browser global (window.MTGRulesUnearth) + Node module. "[cost]: Return this card from your graveyard
 * to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would
 * leave the battlefield." Composes the mana + zone systems: pay the cost, return the card under its
 * OWNER, and mark it `unearthed` so the driver can (a) treat it as hasty, (b) exile it at end of turn
 * (endOfTurnEvents), and (c) redirect any other departure to exile (replaceLeave — a replacement, so
 * an unearthed creature can never dodge the exile by dying or bouncing).
 *
 *   def.unearth = { B: 1 }  (a mana cost, same shape as def.mana)
 *
 *   unearthCost(def)                 -> the cost, or null
 *   canUnearth(game, id, ctx)        -> { ok, reason }   (graveyard + cost + owner's mana pool)
 *   unearth(game, id, ctx)           -> [pay…, card_move→battlefield, __set unearthed]
 *   isUnearthed(game, id) / hasHaste(game, id)  -> predicates
 *   replaceLeave(game, id, toZone)   -> card_move→exile replacement event, or null
 *   endOfTurnEvents(game, ctx)       -> [card_move→exile…] for every unearthed permanent
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesUnearth = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function unearthCost(def) { return (def && def.unearth) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canUnearth(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[id]; if (!c) return { ok: false, reason: "no such card" };
    if (c.zone !== "graveyard") return { ok: false, reason: "unearth only works from the graveyard" };
    var cost = unearthCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no unearth cost" };
    var seat = c.ownerSeat != null ? c.ownerSeat : c.controllerSeat;
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the unearth cost" };
    return { ok: true, seat: seat, cost: cost };
  }

  function unearth(game, id, ctx) {
    var chk = canUnearth(game, id, ctx); if (!chk.ok) return [];
    var c = game.cards[id];
    var events = payEvents(game, chk.seat, chk.cost, ctx);
    events.push({ t: "card_move", instanceId: id, toZone: "battlefield", x: c.x != null ? c.x : 50, y: c.y != null ? c.y : 50 });
    events.push({ t: "__set", cards: [{ id: id, fields: { unearthed: true, controllerSeat: chk.seat } }] });
    return events;
  }

  function isUnearthed(game, id) { var c = game.cards[id]; return !!(c && c.unearthed && c.zone === "battlefield"); }
  function hasHaste(game, id) { return isUnearthed(game, id); } // unearthed permanents are always hasty

  // replacement: if an unearthed permanent would leave the battlefield for anywhere but exile, exile it instead
  function replaceLeave(game, id, toZone) {
    if (!isUnearthed(game, id)) return null;
    if (toZone === "exile" || toZone === "battlefield") return null;
    return { t: "card_move", instanceId: id, toZone: "exile" };
  }

  // at the beginning of the (next) end step: exile every unearthed permanent still on the battlefield
  function endOfTurnEvents(game, ctx) {
    var events = [];
    Object.keys(game.cards).sort().forEach(function (id) {
      if (isUnearthed(game, id)) events.push({ t: "card_move", instanceId: id, toZone: "exile" });
    });
    return events;
  }

  return { unearthCost: unearthCost, canUnearth: canUnearth, unearth: unearth, isUnearthed: isUnearthed, hasHaste: hasHaste, replaceLeave: replaceLeave, endOfTurnEvents: endOfTurnEvents };
});

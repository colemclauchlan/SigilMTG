/*
 * rules-ninjutsu.js — ninjutsu (CR 702.49). PURE.
 * Browser global (window.MTGRulesNinjutsu) + Node module. "[Ninjutsu cost], Return an unblocked attacker
 * you control to hand: Put this card onto the battlefield from your hand tapped and attacking." Activated
 * during the declare-blockers step. This module owns the ninjutsu cost, the eligibility check (ninja in
 * hand + payable; the swapped creature is an unblocked attacker you control), and the swap events.
 *
 *   def.ninjutsu = { generic:1, U:1 }
 *
 *   ninjutsuCost(def)                                       -> the ninjutsu cost, or null
 *   canNinjutsu(game, ninjaId, attackerId, seat, ctx)       -> { ok, reason }
 *   ninjutsuEvents(game, ninjaId, attackerId, ctx)          -> [pay…, attacker→hand, ninja→battlefield tapped+attacking]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesNinjutsu = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }

  function ninjutsuCost(def) { return (def && def.ninjutsu) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canNinjutsu(game, ninjaId, attackerId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var ninja = game.cards[ninjaId];
    if (!ninja || ninja.zone !== "hand") return { ok: false, reason: "the ninja must be in your hand" };
    if (owner(ninja) !== seat) return { ok: false, reason: "not your card" };
    var cost = ninjutsuCost(Cards && Cards.get(ninja.name));
    if (!cost) return { ok: false, reason: "no ninjutsu" };
    var atk = game.cards[attackerId];
    if (!atk || atk.zone !== "battlefield" || owner(atk) !== seat) return { ok: false, reason: "return an attacker you control" };
    if (!atk.attacking) return { ok: false, reason: "that creature isn't attacking" };
    if (atk.blocked) return { ok: false, reason: "that attacker is blocked" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the ninjutsu cost" };
    return { ok: true };
  }

  // pay the cost, bounce the unblocked attacker, and drop the ninja in tapped + attacking
  function ninjutsuEvents(game, ninjaId, attackerId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var ninja = game.cards[ninjaId], atk = game.cards[attackerId];
    if (!ninja || !atk) return [];
    var events = payEvents(game, owner(ninja), ninjutsuCost(Cards && Cards.get(ninja.name)), ctx);
    events.push({ t: "card_move", instanceId: attackerId, toZone: "hand" });
    events.push({ t: "card_move", instanceId: ninjaId, toZone: "battlefield" });
    events.push({ t: "__set", cards: [{ id: ninjaId, fields: { tapped: true, attacking: true, summoningSick: false } }] });
    return events;
  }

  return { ninjutsuCost: ninjutsuCost, canNinjutsu: canNinjutsu, ninjutsuEvents: ninjutsuEvents };
});

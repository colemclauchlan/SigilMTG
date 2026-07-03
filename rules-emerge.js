/*
 * rules-emerge.js — emerge (CR 702.98). PURE (drives engine-core mana).
 * Browser global (window.MTGRulesEmerge) + Node module. "Emerge [cost]" is an alternative cost: "You may
 * cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature's mana
 * value." The generic portion of the emerge cost is reduced (not below 0) by the sacrificed creature's
 * CMC; colored pips are unchanged. This module computes the reduced cost, validates the sacrifice, and
 * emits the sac + mana-payment events (leaning on rules-mana like rules-blitz does).
 *
 *   def.emerge = { generic: 6, U: 1 }  (a mana cost, same shape as def.mana)
 *
 *   emergeCost(def)                                    -> the base emerge cost, or null
 *   reducedCost(baseCost, sacrificedCmc)               -> cost with generic reduced by the sac's CMC (floor 0)
 *   canEmerge(game, spellId, sacId, ctx)               -> { ok, reason, seat, cost }
 *   castEmerge(game, spellId, sacId, ctx)              -> [sac→graveyard, pay…, card_move→battlefield]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesEmerge = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function defOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    return (c && Cards && Cards.get(c.name)) || null;
  }

  function emergeCost(def) { return (def && def.emerge) || null; }

  function cmcOf(def) {
    if (!def || !def.mana) return 0;
    var total = 0; for (var k in def.mana) total += (def.mana[k] | 0);
    return total;
  }

  function isCreature(def) { return !!(def && (def.types || []).indexOf("creature") >= 0); }

  // reduce the GENERIC part of the emerge cost by the sacrificed creature's mana value (never below 0)
  function reducedCost(baseCost, sacrificedCmc) {
    if (!baseCost) return null;
    var out = {}; for (var k in baseCost) out[k] = baseCost[k];
    var gen = (out.generic | 0) - (sacrificedCmc | 0);
    out.generic = gen > 0 ? gen : 0;
    if (out.generic === 0) delete out.generic;
    return out;
  }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canEmerge(game, spellId, sacId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var s = game.cards[spellId]; if (!s) return { ok: false, reason: "no such spell" };
    var base = emergeCost(defOf(game, spellId, ctx));
    if (!base) return { ok: false, reason: "no emerge cost" };
    var sac = game.cards[sacId]; if (!sac) return { ok: false, reason: "no creature to sacrifice" };
    if (sac.zone !== "battlefield") return { ok: false, reason: "sacrifice must be on the battlefield" };
    var seat = s.ownerSeat != null ? s.ownerSeat : s.controllerSeat;
    if (sac.controllerSeat !== seat) return { ok: false, reason: "you can only sacrifice your own creature" };
    if (!isCreature(defOf(game, sacId, ctx))) return { ok: false, reason: "emerge sacrifices a creature" };
    var cost = reducedCost(base, cmcOf(defOf(game, sacId, ctx)));
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the reduced emerge cost" };
    return { ok: true, seat: seat, cost: cost };
  }

  function castEmerge(game, spellId, sacId, ctx) {
    var chk = canEmerge(game, spellId, sacId, ctx); if (!chk.ok) return [];
    var events = [{ t: "card_move", instanceId: sacId, toZone: "graveyard" }];
    events = events.concat(payEvents(game, chk.seat, chk.cost, ctx));
    events.push({ t: "card_move", instanceId: spellId, toZone: "battlefield", x: 50, y: 60 });
    return events;
  }

  return { emergeCost: emergeCost, cmcOf: cmcOf, reducedCost: reducedCost, canEmerge: canEmerge, castEmerge: castEmerge };
});

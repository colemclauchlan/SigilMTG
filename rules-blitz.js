/*
 * rules-blitz.js — blitz (CR 702.152). PURE (drives engine-core).
 * Browser global (window.MTGRulesBlitz) + Node module. "You may cast this spell for its blitz cost.
 * If you do, it gains haste and 'When this creature dies, draw a card.' Sacrifice it at the beginning
 * of the next end step." Casting for blitz pays the alternative cost and drops the creature onto the
 * battlefield with a `blitzed` marker; the driver then (a) treats it as hasty (hasHaste), (b) sacrifices
 * it at end of turn (endOfTurnEvents), and (c) draws its controller a card whenever it dies (onDeath —
 * including from the end-step sacrifice itself).
 *
 *   def.blitz = { generic: 3, B: 1 }  (a mana cost, same shape as def.mana)
 *
 *   blitzCost(def)               -> the cost, or null
 *   canBlitz(game, id, ctx)      -> { ok, reason }   (hand + cost + controller's mana pool)
 *   castBlitz(game, id, ctx)     -> [pay…, card_move→battlefield, __set blitzed]
 *   isBlitzed / hasHaste(game, id, ctx)  -> predicates
 *   endOfTurnEvents(game, ctx)   -> [card_move→graveyard…] (the end-step sacrifice)
 *   onDeath(game, id, ctx)       -> [draw] for the controller, or null if not blitzed
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesBlitz = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function blitzCost(def) { return (def && def.blitz) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canBlitz(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[id]; if (!c) return { ok: false, reason: "no such card" };
    if (c.zone !== "hand") return { ok: false, reason: "blitz is a way to cast the card from your hand" };
    var cost = blitzCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no blitz cost" };
    var seat = c.ownerSeat != null ? c.ownerSeat : c.controllerSeat;
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the blitz cost" };
    return { ok: true, seat: seat, cost: cost };
  }

  function castBlitz(game, id, ctx) {
    var chk = canBlitz(game, id, ctx); if (!chk.ok) return [];
    var events = payEvents(game, chk.seat, chk.cost, ctx);
    events.push({ t: "card_move", instanceId: id, toZone: "battlefield", x: 50, y: 60 });
    events.push({ t: "__set", cards: [{ id: id, fields: { blitzed: true } }] });
    return events;
  }

  function isBlitzed(game, id) { var c = game.cards[id]; return !!(c && c.blitzed); }

  function hasHaste(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id]; if (!c) return false;
    if (c.blitzed) return true;
    var def = Cards && Cards.get(c.name);
    return !!(def && (def.abilities || []).indexOf("haste") >= 0);
  }

  // beginning of the end step: sacrifice every blitzed creature still on the battlefield.
  // (each sacrifice is a death — the driver should follow up with onDeath for the draw)
  function endOfTurnEvents(game, ctx) {
    var events = [];
    Object.keys(game.cards).sort().forEach(function (id) {
      var c = game.cards[id];
      if (c && c.blitzed && c.zone === "battlefield") events.push({ t: "card_move", instanceId: id, toZone: "graveyard" });
    });
    return events;
  }

  // "When this creature dies, draw a card." — fires on ANY death while blitzed (combat, removal, the EOT sac)
  function onDeath(game, id, ctx) {
    var c = game.cards[id]; if (!c || !c.blitzed) return null;
    return [{ t: "draw", seat: c.controllerSeat, count: 1 }];
  }

  return { blitzCost: blitzCost, canBlitz: canBlitz, castBlitz: castBlitz, isBlitzed: isBlitzed, hasHaste: hasHaste, endOfTurnEvents: endOfTurnEvents, onDeath: onDeath };
});

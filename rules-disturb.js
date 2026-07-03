/*
 * rules-disturb.js — disturb (CR 702.146). PURE.
 * Browser global (window.MTGRulesDisturb) + Node module. "You may cast this card transformed from your
 * graveyard by paying its disturb cost." Disturb lives on the FRONT face of a double-faced card; casting
 * it for the disturb cost puts the BACK face onto the stack (transformed), and — like flashback — if that
 * permanent would ever leave the battlefield, it's exiled instead. This module composes graveyard + mana:
 * validate, pay the disturb cost, move graveyard → stack with a `disturbedCast` + `transformed` flag.
 *
 *   def.disturb = { generic:1, W:1 }     // the alternative cost (on the front face's def)
 *
 *   disturbCost(def)                       -> the disturb cost, or null
 *   canDisturb(game, cardId, seat, ctx)    -> { ok, reason }
 *   disturbEvents(game, cardId, ctx)       -> [pay disturb cost, move → stack, mark disturbedCast+transformed]
 *   resolveExile(game, cardId)             -> [card_move → exile] for a disturb-cast permanent (else [])
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDisturb = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function disturbCost(def) { return (def && def.disturb) || null; }

  function canDisturb(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "graveyard") return { ok: false, reason: "card is not in the graveyard" };
    if (c.ownerSeat !== seat) return { ok: false, reason: "not your card" };
    var def = Cards && Cards.get(c.name), db = disturbCost(def);
    if (!db) return { ok: false, reason: "no disturb" };
    if (Mana && !Mana.canPay(db, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the disturb cost" };
    return { ok: true };
  }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function disturbEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId], def = Cards && Cards.get(c.name), seat = c.ownerSeat, db = disturbCost(def);
    var events = payEvents(game, seat, db, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    // cast transformed: the back face is on the stack; mark so it exiles if it later leaves the battlefield
    events.push({ t: "__set", cards: [{ id: cardId, fields: { disturbedCast: true, transformed: true } }] });
    return events;
  }

  // a disturb-cast permanent is EXILED instead of going anywhere else when it leaves the battlefield
  function resolveExile(game, cardId) {
    var c = game.cards[cardId];
    return c && c.disturbedCast ? [{ t: "card_move", instanceId: cardId, toZone: "exile" }] : [];
  }

  return { disturbCost: disturbCost, canDisturb: canDisturb, disturbEvents: disturbEvents, resolveExile: resolveExile };
});

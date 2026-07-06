/*
 * rules-entwine.js — entwine (CR 702.42). PURE.
 * Browser global (window.MTGRulesEntwine) + Node module. A modal spell with entwine lets you choose ALL of
 * its modes instead of the usual "choose one" if you pay the additional entwine cost as you cast it. This
 * module owns the entwine cost, the payability check, the cast events (base cast + entwine cost + a flag),
 * and a helper that returns every mode when the spell was entwined.
 *
 *   def.entwine = { generic:2 }
 *   def.modes   = [ {text:"Destroy target artifact"}, {text:"Destroy target enchantment"} ]
 *
 *   entwineCost(def)                             -> the entwine cost, or null
 *   canEntwine(game, cardId, seat, ctx)          -> { ok, reason }   (in hand, yours, modal, can pay entwine)
 *   castEntwinedEvents(game, cardId, ctx)        -> [pay entwine…, hand→stack, __set entwined]
 *   chosenModes(def, entwined)                   -> [modeIndex…]  (all modes if entwined, else null to choose)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesEntwine = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }

  function entwineCost(def) { return (def && def.entwine) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canEntwine(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "you cast the spell from your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var def = Cards && Cards.get(c.name);
    var cost = entwineCost(def);
    if (!cost) return { ok: false, reason: "no entwine" };
    if (!def.modes || def.modes.length < 2) return { ok: false, reason: "not a modal spell" };
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the entwine cost" };
    return { ok: true };
  }

  // cast paying the extra entwine cost, and flag the spell so all its modes are chosen
  function castEntwinedEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var cost = entwineCost(Cards && Cards.get(c.name)); if (!cost) return [];
    var events = payEvents(game, owner(c), cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { entwined: true } }] });
    return events;
  }

  // an entwined spell uses every mode; otherwise the caller still has to choose one
  function chosenModes(def, entwined) {
    if (!def || !def.modes) return null;
    if (!entwined) return null;
    return def.modes.map(function (m, i) { return i; });
  }

  return { entwineCost: entwineCost, canEntwine: canEntwine, castEntwinedEvents: castEntwinedEvents, chosenModes: chosenModes };
});

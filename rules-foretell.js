/*
 * rules-foretell.js — foretell (CR 702.143). PURE.
 * Browser global (window.MTGRulesForetell) + Node module. "Foretell — During your turn, you may pay {2}
 * and exile this card from your hand face down. Cast it on a later turn for its foretell cost." Composes
 * the exile + (hidden) face-down state + an alternative cost.
 *
 *   def.foretell = { generic:1, U:1 }      // the cost to cast it later (the {2} to foretell is fixed)
 *
 *   foretellEvents(game, cardId, ctx)        -> [pay {2}, hand → exile FACE-DOWN, mark foretold]
 *   canCastForetold(game, cardId, seat, ctx)  -> { ok, reason }
 *   castForetoldEvents(game, cardId, ctx)     -> [pay the foretell cost, exile → stack, turn face up]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesForetell = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"); if (!cost || !Mana) return [];
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {}, out = [];
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) out.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return out;
  }

  function foretellEvents(game, cardId, ctx) {
    var c = game.cards[cardId], seat = c.controllerSeat != null ? c.controllerSeat : c.ownerSeat;
    return payEvents(game, seat, { generic: 2 }, ctx).concat([
      { t: "card_move", instanceId: cardId, toZone: "exile" },
      { t: "__set", cards: [{ id: cardId, fields: { faceDown: true, foretold: true } }] }
    ]);
  }

  function canCastForetold(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "exile" || !c.foretold) return { ok: false, reason: "not a foretold card in exile" };
    if (c.ownerSeat !== seat) return { ok: false, reason: "not your card" };
    var fc = (Cards && Cards.get(c.name) || {}).foretell;
    if (!fc) return { ok: false, reason: "no foretell" };
    if (Mana && !Mana.canPay(fc, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the foretell cost" };
    return { ok: true };
  }

  function castForetoldEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[cardId], seat = c.ownerSeat;
    var fc = (Cards && Cards.get(c.name) || {}).foretell;
    return payEvents(game, seat, fc, ctx).concat([
      { t: "card_move", instanceId: cardId, toZone: "stack" },
      { t: "__set", cards: [{ id: cardId, fields: { faceDown: false } }] }
    ]);
  }

  return { foretellEvents: foretellEvents, canCastForetold: canCastForetold, castForetoldEvents: castForetoldEvents };
});

/*
 * engine-autopilot.js — a simple greedy auto-player. PURE (drives engine-core via its public API).
 * Browser global (window.MTGAutopilot) + Node module. Ties the whole engine together: it reads the
 * board, plays a land, taps lands for mana, checks affordability (rules-mana), and casts the most
 * expensive affordable creature through the stack. Single-player / demo policy — deterministic, no
 * randomness. It composes table-core + card-defs + rules-mana + engine-core; it does not reshape state.
 *
 * This is the "the engine makes plays" demonstration. A real opponent AI (combat decisions, responses,
 * targeting) is much larger; this is the smallest end-to-end auto-play loop over the curated cards.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGAutopilot = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function Core() { return root.MTGCore; }
  function getCards(ctx) { return (ctx && ctx.Cards) || root.MTGCards; }
  function getMana(ctx) { return (ctx && ctx.Mana) || root.MTGRulesMana; }

  function manaValue(mana) { var t = (mana && mana.generic) || 0; ["W", "U", "B", "R", "G", "C"].forEach(function (c) { t += (mana && mana[c]) || 0; }); return t; }
  function poolOf(estate, seat, Mana) { return Mana.poolFromCounters(estate.game.players[seat].counters); }

  function isLand(def) { return def && def.types.indexOf("land") >= 0; }
  function isCreature(def) { return def && def.types.indexOf("creature") >= 0; }

  // play the first land found in hand
  function playLand(E, estate, seat, ctx) {
    var Cards = getCards(ctx), s = estate, hand = Core().cardsOf(s.game, seat, "hand");
    for (var i = 0; i < hand.length; i++) {
      var def = Cards.get(hand[i].name);
      if (isLand(def)) { s = E.dispatch(s, { t: "card_move", instanceId: hand[i].instanceId, toZone: "battlefield", x: 50, y: 72 }); return { estate: s, played: hand[i].instanceId }; }
    }
    return { estate: s, played: null };
  }

  // tap every untapped mana-producing permanent for mana
  function tapLands(E, estate, seat, ctx) {
    var Cards = getCards(ctx), s = estate, bf = Core().cardsOf(s.game, seat, "battlefield");
    bf.forEach(function (c) {
      var def = Cards.get(c.name);
      if (def && def.produces && !c.tapped) Cards.manaEvents(def, { instanceId: c.instanceId, controllerSeat: seat }).forEach(function (ev) { s = E.dispatch(s, ev); });
    });
    return s;
  }

  // overwrite the mana pool to a given {color:n} (zero existing mana_*, then add)
  function setPool(E, estate, seat, pool) {
    var s = estate, cur = s.game.players[seat].counters || {};
    for (var k in cur) { if (k.indexOf("mana_") === 0 && cur[k]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: k, delta: -cur[k] }); }
    for (var c in pool) { if (pool[c]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: "mana_" + c, delta: pool[c] }); }
    return s;
  }

  // cast the most expensive affordable creature in hand; returns {estate, cast}
  function castAffordable(E, estate, seat, ctx) {
    var Cards = getCards(ctx), Mana = getMana(ctx), s = estate, hand = Core().cardsOf(s.game, seat, "hand");
    var best = null, bestCmc = -1, pool = poolOf(s, seat, Mana);
    hand.forEach(function (c) {
      var def = Cards.get(c.name);
      if (isCreature(def) && def.mana && Mana.canPay(def.mana, pool)) { var cmc = manaValue(def.mana); if (cmc > bestCmc) { bestCmc = cmc; best = c; } }
    });
    if (!best) return { estate: s, cast: null };
    var def = Cards.get(best.name);
    s = setPool(E, s, seat, Mana.pay(def.mana, pool));                 // deduct the cost from the pool
    s = E.dispatch(s, { t: "card_move", instanceId: best.instanceId, toZone: "stack" });
    s = E.dispatch(s, { t: "stack_push", id: "cast-" + best.instanceId, controllerSeat: seat, kind: "spell", effects: Cards.castEffects(def, { instanceId: best.instanceId, x: 40, y: 55 }) });
    var g = 0; while (s.stack.length && g++ < 12) s = E.passPriority(s);  // all pass -> resolves
    return { estate: s, cast: best.instanceId };
  }

  // a full main-phase: play a land, tap out, cast affordable creatures until none remain
  function playMainPhase(E, estate, seat, ctx) {
    var s = playLand(E, estate, seat, ctx).estate;
    s = tapLands(E, s, seat, ctx);
    var guard = 0;
    while (guard++ < 12) { var r = castAffordable(E, s, seat, ctx); s = r.estate; if (!r.cast) break; }
    return s;
  }

  return { manaValue: manaValue, playLand: playLand, tapLands: tapLands, setPool: setPool, castAffordable: castAffordable, playMainPhase: playMainPhase };
});

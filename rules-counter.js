/*
 * rules-counter.js — counterspells (CR 701.5 "counter"). PURE (drives engine-core).
 * Browser global (window.MTGRulesCounter) + Node module. A counterspell is just a spell whose effect
 * the engine understands: it goes on the stack normally (so APNAP/priority/replay are unchanged) and,
 * on resolution, its `counter_target` effect removes the targeted object from the stack — engine-core
 * handles that effect type and sends the countered spell's card to its owner's graveyard.
 *
 *   castCounter(E, estate, counterCardId, targetStackId, ctx) -> { estate, ok, reason }
 *
 * Honors an `uncounterable` flag on the target stack object ("can't be countered"). Mana payment mirrors
 * rules-spells (pool = the controller's mana_<C> counters). The counter itself (an instant) is sent to
 * the graveyard after it resolves.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesCounter = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  // stack objects that a counterspell could legally target (spells/abilities, minus uncounterable)
  function counterableTargets(estate) {
    return (estate.stack || []).filter(function (o) { return !o.uncounterable; });
  }

  function setPool(E, estate, seat, pool) {
    var s = estate, cur = s.game.players[seat].counters || {};
    for (var k in cur) { if (k.indexOf("mana_") === 0 && cur[k]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: k, delta: -cur[k] }); }
    for (var c in (pool || {})) { if (pool[c]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: "mana_" + c, delta: pool[c] }); }
    return s;
  }

  function castCounter(E, estate, counterCardId, targetStackId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var s = estate, card = s.game.cards[counterCardId];
    if (!card) return { estate: s, ok: false, reason: "no such card" };
    var def = Cards ? Cards.get(card.name) : null;
    var seat = card.controllerSeat;

    var target = (s.stack || []).filter(function (o) { return o.id === targetStackId; })[0];
    if (!target) return { estate: s, ok: false, reason: "target not on the stack" };
    if (target.uncounterable) return { estate: s, ok: false, reason: "that spell can't be countered" };

    if (def && def.mana && Mana) {
      var pool = Mana.poolFromCounters(s.game.players[seat].counters);
      if (!Mana.canPay(def.mana, pool)) return { estate: s, ok: false, reason: "cannot pay mana" };
      s = setPool(E, s, seat, Mana.pay(def.mana, pool));
    }

    var effects = [
      { t: "counter_target", target: targetStackId },                          // engine removes it from the stack
      { t: "card_move", instanceId: counterCardId, toZone: "graveyard" }        // the counter (instant) -> graveyard
    ];
    s = E.dispatch(s, { t: "card_move", instanceId: counterCardId, toZone: "stack" });
    s = E.dispatch(s, { t: "stack_push", id: (ctx && ctx.id) || ("sp-" + counterCardId), controllerSeat: seat, kind: "spell", source: counterCardId, effects: effects });
    return { estate: s, ok: true };
  }

  return { castCounter: castCounter, counterableTargets: counterableTargets };
});

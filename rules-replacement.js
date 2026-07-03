/*
 * rules-replacement.js — enters-the-battlefield replacement effects (CR 614 subset). PURE (drives engine).
 * Browser global (window.MTGRulesReplacement) + Node module. When a permanent enters, applies its
 * intrinsic "enters with N counters" / "enters tapped", plus global ETB-counter bonuses from other
 * permanents (e.g. Hardened Scales: "+1/+1 counters enter with an extra one"). Applying the counters
 * right after entry is functionally equivalent for our purposes (full event-rewriting is deferred).
 *
 *   def.entersWith = { counter: "+1/+1", count: N }
 *   def.entersTapped = true
 *   def.static = [ { kind:"etb-bonus", affects:"creatures-you-control"|"all", counter:"+1/+1", amount:1 } ]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesReplacement = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function etbBonus(game, ownerSeat, counterKind, Cards) {
    var bonus = 0;
    for (var id in game.cards) {
      var c = game.cards[id]; if (c.zone !== "battlefield") continue;
      var def = Cards ? Cards.get(c.name) : null; if (!def || !def.static) continue;
      def.static.forEach(function (st) {
        if (st.kind !== "etb-bonus" || (st.counter || "+1/+1") !== counterKind) return;
        if (st.affects === "all" || (st.affects === "creatures-you-control" && c.controllerSeat === ownerSeat)) bonus += (st.amount || 1);
      });
    }
    return bonus;
  }

  // call right after a permanent has entered the battlefield
  function applyEnter(E, estate, instanceId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), s = estate, card = s.game.cards[instanceId];
    if (!card) return s;
    var def = Cards ? Cards.get(card.name) : null; if (!def) return s;
    if (def.entersWith && def.entersWith.count) {
      var kind = def.entersWith.counter || "+1/+1";
      var total = def.entersWith.count + etbBonus(s.game, card.controllerSeat, kind, Cards);
      if (total) s = E.dispatch(s, { t: "card_counter", instanceId: instanceId, kind: kind, delta: total });
    }
    if (def.entersTapped && !card.tapped) s = E.dispatch(s, { t: "card_tap", instanceId: instanceId, tapped: true });
    return s;
  }

  return { applyEnter: applyEnter, etbBonus: etbBonus };
});

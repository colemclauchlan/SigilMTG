/*
 * rules-training.js — training (CR 702.149). PURE.
 * Browser global (window.MTGRulesTraining) + Node module. "Whenever this creature attacks with another
 * creature with greater power, put a +1/+1 counter on this creature." Training is a combat trigger that
 * checks, at declare-attackers, whether at least ONE co-attacker has strictly greater EFFECTIVE power
 * than the trainee. If so, the trainee earns one +1/+1 counter. This module is a pure decision layer over
 * a set of declared attackers: which trainees trigger, and the counter events to apply.
 *
 *   hasTraining(game, id, ctx)                          -> printed/granted training
 *   trainsWith(game, traineeId, attackerIds, ctx)       -> true if some co-attacker has greater power
 *   trainingEvents(game, attackerIds, ctx)              -> [card_counter +1/+1 …] for every trainee that trains
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesTraining = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    var c = game.cards[id]; if (!c) return [];
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }

  // effective power (counters + anthems) when rules-keywords/layers are present, else printed + counters
  function powerOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), Layers = pick(ctx, "Layers", "MTGRulesLayers");
    var c = game.cards[id]; if (!c) return 0;
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e && e.power != null) return e.power; }
    var def = Cards && Cards.get(c.name);
    if (def && Layers) {
      var base = Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat });
      var st = Layers.computeEffectiveState(base, []);
      if (st && st.power != null) return st.power;
    }
    var p = def && def.power != null ? def.power : 0;
    var plus = (c.counters && c.counters["+1/+1"]) || 0, minus = (c.counters && c.counters["-1/-1"]) || 0;
    return p + plus - minus;
  }

  function hasTraining(game, id, ctx) { return abilitiesOf(game, id, ctx).indexOf("training") >= 0; }

  // does the trainee train given the full set of declared attackers? (needs a co-attacker with GREATER power)
  function trainsWith(game, traineeId, attackerIds, ctx) {
    if (!hasTraining(game, traineeId, ctx)) return false;
    var myPow = powerOf(game, traineeId, ctx);
    return (attackerIds || []).some(function (aid) {
      return aid !== traineeId && powerOf(game, aid, ctx) > myPow;
    });
  }

  // for a declared attack, one +1/+1 counter per trainee that has a stronger co-attacker (deterministic id order)
  function trainingEvents(game, attackerIds, ctx) {
    var ids = (attackerIds || []).slice().sort(), events = [];
    ids.forEach(function (id) {
      if (trainsWith(game, id, attackerIds, ctx)) events.push({ t: "card_counter", instanceId: id, kind: "+1/+1", delta: 1 });
    });
    return events;
  }

  return { hasTraining: hasTraining, trainsWith: trainsWith, trainingEvents: trainingEvents, powerOf: powerOf };
});

/*
 * rules-counters.js — +1/+1 / −1/−1 annihilation (SBA, CR 704.5q) + counter-placement helpers. PURE.
 * Browser global (window.MTGRulesCounters) + Node module. Two things:
 *   1) annihilateEvents(game): the state-based action that removes equal numbers of +1/+1 and −1/−1
 *      counters from any permanent that has both (this is missing from rules-sba and is a real correctness
 *      gap — e.g. a 0/0 with one +1/+1 and one −1/−1 should have ZERO counters and die).
 *   2) placement helpers: placeCounters(id, kind, n) and bolster(game, seat, n, ctx) (put n +1/+1 on the
 *      creature you control with the least toughness — CR 701.30).
 * Counter values feed effective P/T through the layer system, so the results compose with everything.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesCounters = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function placeCounters(id, kind, n) { return { t: "card_counter", instanceId: id, kind: kind, delta: n }; }

  // SBA 704.5q — remove equal numbers of +1/+1 and −1/−1 counters from each permanent that has both
  function annihilateEvents(game) {
    var events = [];
    for (var id in game.cards) {
      var c = game.cards[id]; if (c.zone !== "battlefield" || !c.counters) continue;
      var plus = c.counters["+1/+1"] || 0, minus = c.counters["-1/-1"] || 0, k = Math.min(plus, minus);
      if (k > 0) { events.push({ t: "card_counter", instanceId: id, kind: "+1/+1", delta: -k }); events.push({ t: "card_counter", instanceId: id, kind: "-1/-1", delta: -k }); }
    }
    return events;
  }

  function effToughness(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e && e.toughness != null) return e.toughness; }
    var def = Cards && Cards.get(game.cards[id].name); return def ? def.toughness : null;
  }

  // bolster N: put N +1/+1 counters on the creature you control with the least toughness
  function bolster(game, seat, n, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), best = null, bestT = Infinity;
    for (var id in game.cards) {
      var c = game.cards[id]; if (c.zone !== "battlefield" || c.controllerSeat !== seat) continue;
      var def = Cards && Cards.get(c.name); if (!def || def.types.indexOf("creature") < 0) continue;
      var t = effToughness(game, id, ctx); if (t != null && t < bestT) { bestT = t; best = id; }
    }
    return best ? [placeCounters(best, "+1/+1", n)] : [];
  }

  return { placeCounters: placeCounters, annihilateEvents: annihilateEvents, bolster: bolster };
});

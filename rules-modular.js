/*
 * rules-modular.js — modular (CR 702.43). PURE.
 * Browser global (window.MTGRulesModular) + Node module. Modular N is two abilities on an artifact creature:
 *   1) it ENTERS the battlefield with N +1/+1 counters;
 *   2) when it DIES, you may move all of its +1/+1 counters onto target artifact creature.
 * The counter system feeds effective P/T through the layer system, so a creature that inherits N +1/+1
 * counters simply gets +N/+N. We move the EXACT number of +1/+1 counters the dying creature has at death
 * (which may exceed its printed modular N if it gained more), per the templated ability.
 *
 *   modularEnter(n)                               -> [event] to place N +1/+1 counters as it enters
 *   plusCounters(game, id)                        -> how many +1/+1 counters a card has
 *   modularOnDeath(game, id, targetId, ctx)       -> events moving those +1/+1 counters to the target
 *       (removes them from the source for bookkeeping symmetry; the source is leaving anyway, but the
 *        explicit -delta keeps replays exact and lets callers run it before the zone change). Returns []
 *        when there are no counters to move or the target is missing/not an artifact creature.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesModular = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function plusCounters(game, id) {
    var c = game.cards[id];
    return (c && c.counters && c.counters["+1/+1"]) || 0;
  }

  // Entering with N +1/+1 counters (the static "enters with" half of modular).
  function modularEnter(n) {
    var k = n | 0; if (k <= 0) return [];
    return [{ t: "card_counter", instanceId: undefined, kind: "+1/+1", delta: k }];
  }
  // Same, but bound to a specific instance id (convenience for a known source).
  function modularEnterFor(id, n) {
    var k = n | 0; if (k <= 0) return [];
    return [{ t: "card_counter", instanceId: id, kind: "+1/+1", delta: k }];
  }

  function isArtifactCreature(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    var c = game.cards[id]; if (!c) return false;
    var types = null;
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e && e.types) types = e.types; }
    if (!types) { var def = Cards && Cards.get(c.name); types = def ? def.types : []; }
    return types.indexOf("artifact") >= 0 && types.indexOf("creature") >= 0;
  }

  // On death: move all of the source's +1/+1 counters onto a target artifact creature.
  function modularOnDeath(game, id, targetId, ctx) {
    var n = plusCounters(game, id);
    if (n <= 0) return [];
    if (!targetId || !game.cards[targetId] || !isArtifactCreature(game, targetId, ctx)) return [];
    return [
      { t: "card_counter", instanceId: id, kind: "+1/+1", delta: -n },
      { t: "card_counter", instanceId: targetId, kind: "+1/+1", delta: n }
    ];
  }

  return {
    pick: pick,
    plusCounters: plusCounters, isArtifactCreature: isArtifactCreature,
    modularEnter: modularEnter, modularEnterFor: modularEnterFor, modularOnDeath: modularOnDeath
  };
});

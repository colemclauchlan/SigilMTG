/*
 * rules-persist.js — persist (CR 702.79) & undying (CR 702.93). PURE.
 * Browser global (window.MTGRulesPersist) + Node module. Both are triggered abilities on a creature
 * dying (going to a graveyard from the battlefield) that bring it back under its OWNER's control:
 *   - persist  -> only if it had NO -1/-1 counter on it; it returns with a -1/-1 counter.
 *   - undying  -> only if it had NO +1/+1 counter on it; it returns with a +1/+1 counter.
 * The "had no counter" check looks at the counters the creature had as it died (so a persist creature
 * that already carries a -1/-1 from a previous death will NOT come back again — the classic loop-stopper).
 *
 * Because the engine's `counters` map also stores non-counter bookkeeping (damage/regen/sick), we read
 * only the real +1/+1 / -1/-1 keys. Returning a creature is modeled as a move back to the battlefield
 * (under the owner) plus the counter that the ability adds — replayable events the driver dispatches.
 *
 *   onDeath(game, id, kind, ctx) -> [events]  (move-to-battlefield + counter) or null  (kind: "persist"|"undying")
 *   hasPlusCounter / hasMinusCounter(game, id) predicates; willReturn(game, id, kind) predicate.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesPersist = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function counterOf(game, id, kind) {
    var c = game.cards[id];
    return (c && c.counters && c.counters[kind]) || 0;
  }
  function hasPlusCounter(game, id) { return counterOf(game, id, "+1/+1") > 0; }
  function hasMinusCounter(game, id) { return counterOf(game, id, "-1/-1") > 0; }

  // The counter kind each ability returns the creature with.
  function returnCounterKind(kind) { return kind === "undying" ? "+1/+1" : "-1/-1"; }
  // The counter whose ABSENCE is required for the ability to fire.
  function blockedBy(kind) { return kind === "undying" ? "+1/+1" : "-1/-1"; }

  // Does this creature's death trigger the given ability? (it must lack the relevant counter)
  function willReturn(game, id, kind) {
    var c = game.cards[id]; if (!c) return false;
    return counterOf(game, id, blockedBy(kind)) === 0;
  }

  // When a creature with persist/undying dies: return it to the battlefield under its owner with the
  // appropriate counter, unless it already carries the blocking counter (then nothing happens -> null).
  function onDeath(game, id, kind, ctx) {
    var c = game.cards[id]; if (!c) return null;
    if (!willReturn(game, id, kind)) return null;
    var owner = c.ownerSeat != null ? c.ownerSeat : c.controllerSeat;
    return [
      { t: "card_move", instanceId: id, toZone: "battlefield", x: c.x != null ? c.x : 50, y: c.y != null ? c.y : 50 },
      { t: "__set", cards: [{ id: id, fields: { controllerSeat: owner } }] },
      { t: "card_counter", instanceId: id, kind: returnCounterKind(kind), delta: 1 }
    ];
  }

  return {
    pick: pick,
    hasPlusCounter: hasPlusCounter, hasMinusCounter: hasMinusCounter,
    returnCounterKind: returnCounterKind, blockedBy: blockedBy,
    willReturn: willReturn, onDeath: onDeath
  };
});

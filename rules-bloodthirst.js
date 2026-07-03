/*
 * rules-bloodthirst.js — bloodthirst N (CR 702.54). PURE.
 * Browser global (window.MTGRulesBloodthirst) + Node module. "If an opponent was dealt damage this turn,
 * this creature enters the battlefield with N +1/+1 counters on it." Bloodthirst is a static ETB-replacement:
 * at the moment the creature would enter, if ANY opponent of its controller was dealt damage earlier this
 * turn, it arrives with N +1/+1 counters; otherwise it enters with none. The "opponent damaged this turn"
 * fact is tracked by the caller (combat/burn watcher) and passed in as a boolean.
 *
 *   bloodthirstCounters(game, id, opponentDamagedThisTurn, n, ctx)
 *       -> [ { t:"card_counter", instanceId:id, kind:"+1/+1", delta:N } ]  (or [] when the condition is unmet)
 *
 * Honors GRANTED bloodthirst (a creature granted "bloodthirst" still needs N supplied by the caller, since
 * the keyword's numeric value lives on the printed ability; this module gates the counters on the keyword
 * being present AND an opponent having been damaged). N defaults from the card def's `bloodthirst` field
 * when not explicitly passed. Bloodthirst X (Mphod-style, equal to damage dealt) is deferred & documented.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesBloodthirst = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }

  function hasBloodthirst(abilities) { return (abilities || []).indexOf("bloodthirst") >= 0; }

  // entering counters: N +1/+1 if the creature has bloodthirst AND an opponent was dealt damage this turn
  function bloodthirstCounters(game, id, opponentDamagedThisTurn, n, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Counters = pick(ctx, "Counters", "MTGRulesCounters");
    var c = game.cards[id]; if (!c) return [];
    if (!hasBloodthirst(abilitiesOf(game, id, ctx))) return [];
    if (!opponentDamagedThisTurn) return [];
    var count = n;
    if (count == null) { var def = Cards && Cards.get(c.name); count = def && def.bloodthirst != null ? def.bloodthirst : 0; }
    count = count | 0; if (count <= 0) return [];
    if (Counters && Counters.placeCounters) return [Counters.placeCounters(id, "+1/+1", count)];
    return [{ t: "card_counter", instanceId: id, kind: "+1/+1", delta: count }];
  }

  return { abilitiesOf: abilitiesOf, hasBloodthirst: hasBloodthirst, bloodthirstCounters: bloodthirstCounters };
});

/*
 * rules-surveil.js — surveil (CR 701.42). PURE (drives engine-core).
 * Browser global (window.MTGRulesSurveil) + Node module. "Surveil N: look at the top N cards of your
 * library, then put any number of them into your graveyard and the rest on top in any order." The
 * graveyard half is what separates it from scry (rules-scry sends cards to the BOTTOM). Binned cards
 * become card_move→graveyard events; the kept cards stay on top in their relative order via
 * table-core's library_scry reorder, so the whole thing stays replay-safe.
 *
 *   surveilCount(def)                       -> def.surveil | 0  (spells/permanents that surveil N)
 *   topCards(game, seat, count, ctx)        -> the top N library cards (what the player looks at)
 *   surveilEvents(game, seat, binIds, ctx)  -> [card_move→graveyard…, library_scry(kept order)]
 *   autoSurveil(game, seat, count, ctx)     -> ids to bin (deterministic policy: bin excess lands when
 *                                              flooded, bin blanks when action is needed — mirrors autoScry)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSurveil = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function surveilCount(def) { return (def && def.surveil) | 0; }

  function topCards(game, seat, count, ctx) {
    var Core = pick(ctx, "Core", "MTGCore");
    return Core.cardsOf(game, seat, "library").slice(0, count || 1);
  }

  // binIds go to the graveyard; everything else keeps its relative order on top of the library.
  // Ids that aren't actually in this seat's library are ignored (missing-card safety).
  function surveilEvents(game, seat, binIds, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), lib = Core.cardsOf(game, seat, "library");
    var bin = {}; (binIds || []).forEach(function (id) { bin[id] = true; });
    var events = [];
    lib.forEach(function (c) { if (bin[c.instanceId]) events.push({ t: "card_move", instanceId: c.instanceId, toZone: "graveyard" }); });
    var kept = lib.filter(function (c) { return !bin[c.instanceId]; }).map(function (c) { return c.instanceId; });
    events.push({ t: "library_scry", order: kept });
    return events;
  }

  // simple AI: among the top `count`, bin lands beyond what the player needs (4+ lands in play = flooded),
  // otherwise bin "blanks" (no body, no spell text, no mana) so the next draws are live. Deterministic.
  function autoSurveil(game, seat, count, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), Cards = pick(ctx, "Cards", "MTGCards");
    var landsInPlay = Core.cardsOf(game, seat, "battlefield").filter(function (c) { var d = Cards && Cards.get(c.name); return d && d.types.indexOf("land") >= 0; }).length;
    var flooded = landsInPlay >= 4;
    var out = [];
    topCards(game, seat, count, ctx).forEach(function (c) {
      var d = Cards && Cards.get(c.name);
      var isLand = d && d.types.indexOf("land") >= 0;
      if (flooded && isLand) out.push(c.instanceId);            // bin excess lands when flooded
      else if (!flooded && !isLand && d && d.power == null && !d.spell && !d.produces) out.push(c.instanceId); // bin blanks when we need action
    });
    return out;
  }

  return { surveilCount: surveilCount, topCards: topCards, surveilEvents: surveilEvents, autoSurveil: autoSurveil };
});

/*
 * rules-evolve.js — evolve (CR 702.100). PURE.
 * Browser global (window.MTGRulesEvolve) + Node module. "Whenever a creature enters the battlefield under
 * your control, if that creature has greater power OR greater toughness than this creature, put a +1/+1
 * counter on this creature." When a creature enters, each evolve creature its controller already controls
 * checks the newcomer's EFFECTIVE power/toughness against ITS OWN effective power/toughness; a strictly
 * greater power OR strictly greater toughness fires the trigger (one counter, even if BOTH are greater).
 * Comparisons use effective P/T (counters, anthems, granted keywords) via rules-keywords/rules-layers, so
 * an evolve creature that has already grown is compared at its current size.
 *
 *   evolveTriggers(game, enteringId, ctx)   -> [ { id: evolveCreatureId, event: <+1/+1 counter event> }, … ]
 *
 * Honors GRANTED evolve (a creature granted "evolve" evaluates too). The entering creature never evolves
 * itself; only creatures under the SAME controller as the newcomer are considered. Each qualifying evolve
 * creature yields exactly one counter event.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesEvolve = mod;
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

  // effective {power,toughness} of a card on the board
  function ptOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), Layers = pick(ctx, "Layers", "MTGRulesLayers");
    var c = game.cards[id]; if (!c) return { power: null, toughness: null };
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e) return { power: e.power, toughness: e.toughness }; }
    var def = Cards && Cards.get(c.name);
    if (def && Layers) {
      var base = Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat });
      var st = Layers.computeEffectiveState(base, []);
      return { power: st.power, toughness: st.toughness };
    }
    return { power: def ? def.power : null, toughness: def ? def.toughness : null };
  }

  function isCreature(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    var c = game.cards[id]; if (!c) return false;
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e && e.types) return e.types.indexOf("creature") >= 0; }
    var def = Cards && Cards.get(c.name); return !!def && def.types.indexOf("creature") >= 0;
  }

  function hasEvolve(abilities) { return (abilities || []).indexOf("evolve") >= 0; }

  // triggers fired by `enteringId` arriving: one +1/+1 per evolve creature it out-sizes (power OR toughness)
  function evolveTriggers(game, enteringId, ctx) {
    var Counters = pick(ctx, "Counters", "MTGRulesCounters");
    var enter = game.cards[enteringId]; if (!enter) return [];
    if (!isCreature(game, enteringId, ctx)) return [];
    var seat = enter.controllerSeat, np = ptOf(game, enteringId, ctx);
    var out = [];
    for (var id in game.cards) {
      if (id === enteringId) continue;
      var c = game.cards[id];
      if (c.zone !== "battlefield" || c.controllerSeat !== seat) continue;
      if (!hasEvolve(abilitiesOf(game, id, ctx))) continue;
      if (!isCreature(game, id, ctx)) continue;
      var ep = ptOf(game, id, ctx);
      var greater = (np.power != null && ep.power != null && np.power > ep.power) ||
                    (np.toughness != null && ep.toughness != null && np.toughness > ep.toughness);
      if (greater) {
        var ev = (Counters && Counters.placeCounters) ? Counters.placeCounters(id, "+1/+1", 1) : { t: "card_counter", instanceId: id, kind: "+1/+1", delta: 1 };
        out.push({ id: id, event: ev });
      }
    }
    return out;
  }

  return { abilitiesOf: abilitiesOf, ptOf: ptOf, isCreature: isCreature, hasEvolve: hasEvolve, evolveTriggers: evolveTriggers };
});

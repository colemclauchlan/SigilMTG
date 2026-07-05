/*
 * engine-assist.js — read-only advisory bridge between the live table state and the rules engine.
 * Browser global (window.MTGEngineAssist) + Node module. Gives the UI a single call to get the
 * engine's *advisory* analysis of the current board without changing any game logic:
 *
 *   const a = MTGEngineAssist.analyze(tableCoreGameState);
 *   // a.sba       -> [ {rule, kind, message, ...} ]   state-based-action findings (lethal life, etc.)
 *   // a.effective -> { instanceId: {power, toughness} } effective P/T for battlefield creatures
 *
 * It only READS the state (never mutates), so wiring it into the renderer is safe: call it after a
 * state change and paint the findings / P/T as an overlay. The deeper, mutating engine (stack,
 * priority, casting) is intentionally NOT auto-run against the live table — that's a separate,
 * reviewed step. This is the conservative first integration surface.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGEngineAssist = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function analyze(game, getDef) {
    var SBA = root.MTGRulesSBA, Layers = root.MTGRulesLayers, Cards = root.MTGCards;
    getDef = getDef || (Cards ? Cards.get : function () { return null; });
    var out = { sba: (SBA && game) ? SBA.detectAll(game) : [], effective: {} };
    if (Layers && game && game.cards) {
      for (var id in game.cards) {
        var c = game.cards[id];
        if (c.zone !== "battlefield") continue;
        var def = getDef(c.name != null ? c.name : c.cardId);
        if (!def || def.power == null) continue;
        var base = (Cards && Cards.printedBase)
          ? Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat })
          : { name: def.name, power: def.power, toughness: def.toughness, counters: c.counters || {}, types: def.types || [], subtypes: [], colors: [], abilities: def.abilities || [] };
        var seff = (root.MTGRulesStatic && root.MTGRulesStatic.effectsForCard) ? root.MTGRulesStatic.effectsForCard(game, id, { Cards: Cards, Layers: Layers }) : [];
        var eff = Layers.computeEffectiveState(base, (c._effects || []).concat(seff));
        out.effective[id] = { power: eff.power, toughness: eff.toughness };
      }
    }
    return out;
  }

  // Are the modules analyze() relies on present in this page/context?
  function ready() { return !!(root.MTGCards && root.MTGRulesLayers && root.MTGRulesSBA); }

  return { analyze: analyze, ready: ready };
});

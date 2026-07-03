/*
 * rules-keywords.js — keyword-granting static abilities (layer 6) + combined effective state. PURE.
 * Browser global (window.MTGRulesKeywords) + Node module. Generates ability-adding (layer 6) effects
 * from "grant" static abilities on the battlefield (lords: "other Goblins have haste"), reusing
 * rules-static's applicability test, and computes a creature's effective state combining BOTH the
 * anthem P/T effects (rules-static) and these keyword grants through rules-layers. Read-only.
 *
 *   def.static = [ { kind:"grant", affects:"creatures-you-control"|"other-creatures-you-control"|"all-creatures",
 *                    subtype?:"goblin", keywords:["haste","trample", …] } ]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  if (root) root.MTGRulesKeywords = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || (root && root[global]); }

  function collectGrants(game, Cards) {
    var out = [];
    for (var id in game.cards) {
      var c = game.cards[id]; if (c.zone !== "battlefield") continue;
      var def = Cards ? Cards.get(c.name) : null; if (!def || !def.static) continue;
      def.static.forEach(function (st) {
        if (st.kind === "grant") out.push({ controllerSeat: c.controllerSeat, affects: st.affects || "creatures-you-control", subtype: st.subtype || null, keywords: st.keywords || [], sourceId: id });
      });
    }
    return out;
  }

  function keywordEffectsForCard(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Static = pick(ctx, "Static", "MTGRulesStatic");
    var card = game.cards[cardId]; if (!card) return [];
    var def = Cards ? Cards.get(card.name) : null, out = [];
    collectGrants(game, Cards).forEach(function (g, i) {
      if (g.keywords.length && Static.anthemAppliesTo(g, card, def)) out.push({ id: "grant-" + g.sourceId + "-" + i, layer: 6, timestamp: i, op: "ability_add", abilities: g.keywords.slice() });
    });
    return out;
  }

  // effective state combining anthem P/T (rules-static) AND keyword grants (here), via rules-layers
  function effectiveFull(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Layers = pick(ctx, "Layers", "MTGRulesLayers"), Static = pick(ctx, "Static", "MTGRulesStatic");
    var card = game.cards[cardId]; if (!card) return null;
    var def = Cards ? Cards.get(card.name) : null; if (!def) return null;
    var base = Cards.printedBase(def, { counters: card.counters, controller: card.controllerSeat });
    var effects = (Static ? Static.effectsForCard(game, cardId, ctx) : []).concat(keywordEffectsForCard(game, cardId, ctx));
    return Layers.computeEffectiveState(base, effects);
  }

  return { collectGrants: collectGrants, keywordEffectsForCard: keywordEffectsForCard, effectiveFull: effectiveFull };
});

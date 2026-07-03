/*
 * rules-static.js — generates continuous effects from static abilities, and effective P/T on board. PURE.
 * Browser global (window.MTGRulesStatic) + Node module. Reads the battlefield for cards whose card-def
 * has `static` abilities (currently anthems / lords) and turns them into the layer-system effects that
 * rules-layers applies — so "+1/+1 to creatures you control" or "+1/+1 to other Goblins" actually buffs
 * the right creatures. Read-only; nothing is mutated.
 *
 *   def.static = [ { kind:"anthem", affects:"creatures-you-control"|"other-creatures-you-control"|"all-creatures",
 *                    subtype?:"goblin", power:N, toughness:N } ]
 *
 * Other static types (cost reduction, can't-attack, keyword granting) are deferred & documented.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesStatic = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function collectAnthems(game, Cards) {
    var out = [];
    for (var id in game.cards) {
      var c = game.cards[id]; if (c.zone !== "battlefield") continue;
      var def = Cards ? Cards.get(c.name) : null; if (!def || !def.static) continue;
      def.static.forEach(function (st) {
        if (st.kind === "anthem") out.push({ controllerSeat: c.controllerSeat, affects: st.affects || "creatures-you-control", subtype: st.subtype || null, power: st.power || 0, toughness: st.toughness || 0, sourceId: id });
      });
    }
    return out;
  }

  function anthemAppliesTo(a, card, def) {
    if (!def || def.types.indexOf("creature") < 0) return false;
    if (a.subtype && (def.subtypes || []).indexOf(a.subtype) < 0) return false;
    if (a.affects === "creatures-you-control") return card.controllerSeat === a.controllerSeat;
    if (a.affects === "other-creatures-you-control") return card.controllerSeat === a.controllerSeat && card.instanceId !== a.sourceId;
    if (a.affects === "all-creatures") return true;
    return false;
  }

  // continuous effects (rules-layers shape) that apply to one card, from all static abilities on board
  function effectsForCard(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var card = game.cards[cardId]; if (!card) return [];
    var def = Cards ? Cards.get(card.name) : null;
    var out = [];
    collectAnthems(game, Cards).forEach(function (a, i) {
      if (anthemAppliesTo(a, card, def)) out.push({ id: "anthem-" + a.sourceId + "-" + i, layer: 7, sublayer: "d", timestamp: i, op: "pt_mod", power: a.power, toughness: a.toughness });
    });
    return out;
  }

  // effective characteristics of a creature on the board, including static-ability effects
  function effectiveOnBoard(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Layers = pick(ctx, "Layers", "MTGRulesLayers");
    var card = game.cards[cardId]; if (!card) return null;
    var def = Cards ? Cards.get(card.name) : null; if (!def) return null;
    var base = Cards.printedBase(def, { counters: card.counters, controller: card.controllerSeat });
    return Layers.computeEffectiveState(base, effectsForCard(game, cardId, ctx));
  }

  return { collectAnthems: collectAnthems, anthemAppliesTo: anthemAppliesTo, effectsForCard: effectsForCard, effectiveOnBoard: effectiveOnBoard };
})
;

/*
 * rules-prototype.js — prototype (CR 702.160). PURE.
 * Browser global (window.MTGRulesPrototype) + Node module. "You may cast this card as a [color], [P/T]
 * creature for [prototype cost]. It keeps its abilities and types. Note its power/toughness and color."
 * A prototype card is normally a colorless artifact creature; casting it "as prototype" makes it a smaller,
 * colored version with an alternative cost and a different printed P/T. This module reports which mode a
 * card is being cast in and the RESULTING characteristics (cost, colors, power, toughness) for each mode,
 * plus the marker events so the layers/keywords systems read the prototype stats while it's in play.
 *
 *   def.prototype = { cost:{ generic:1, U:1 }, colors:["U"], power:1, toughness:4 }
 *   // the card's normal (full) side stays on def.mana / def.colors / def.power / def.toughness
 *
 *   hasPrototype(def)                              -> boolean
 *   modeCost(def, mode)                            -> mana cost for "prototype" | "full"
 *   modeStats(def, mode)                           -> { colors, power, toughness } for the chosen mode
 *   castEvents(game, cardId, mode, ctx)            -> [card_move→stack, __set prototypeMode] for a prototype cast
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesPrototype = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function defOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    return (c && Cards && Cards.get(c.name)) || null;
  }

  function hasPrototype(def) { return !!(def && def.prototype); }

  function modeCost(def, mode) {
    if (!def) return null;
    if (mode === "prototype" && def.prototype) return def.prototype.cost || null;
    return def.mana || null;
  }

  function modeStats(def, mode) {
    if (!def) return { colors: [], power: null, toughness: null };
    if (mode === "prototype" && def.prototype) {
      var p = def.prototype;
      return { colors: (p.colors || []).slice(), power: p.power != null ? p.power : def.power, toughness: p.toughness != null ? p.toughness : def.toughness };
    }
    return { colors: (def.colors || []).slice(), power: def.power != null ? def.power : null, toughness: def.toughness != null ? def.toughness : null };
  }

  // cast the card in the given mode; a prototype cast records prototypeMode so the layers system applies
  // the smaller colored stats while the permanent is in play.
  function castEvents(game, cardId, mode, ctx) {
    var c = game.cards[cardId]; if (!c) return [];
    var def = defOf(game, cardId, ctx); if (!def) return [];
    if (mode === "prototype" && !hasPrototype(def)) return [];
    var events = [{ t: "card_move", instanceId: cardId, toZone: "stack" }];
    events.push({ t: "__set", cards: [{ id: cardId, fields: { prototypeMode: mode === "prototype" } }] });
    return events;
  }

  return { hasPrototype: hasPrototype, modeCost: modeCost, modeStats: modeStats, castEvents: castEvents };
});

/*
 * rules-renown.js — renown (CR 702.111). PURE (drives engine-core/table-core events).
 * "Renown N — When this creature deals combat damage to a player, if it isn't renowned,
 * put N +1/+1 counters on it and it becomes renowned."
 * Card def: Cards.define("Name", { renown: 2, ... }).
 * The caller decides WHEN combat damage to a player happened (the live board resolves combat
 * itself); this module owns the state transition: the canRenown() gate + renownEvents()
 * counter/flag events, riding the already-synced card_counter + __set primitives.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesRenown = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function defOf(game, id, ctx) { var Cards = pick(ctx, "Cards", "MTGCards"); var c = game.cards[id]; return (c && Cards) ? Cards.get(c.name != null ? c.name : c.cardId) : null; }

  function renownValue(def) { return (def && def.renown != null) ? (def.renown || 0) : null; }
  function isRenowned(game, id) { var c = game.cards[id]; return !!(c && c.renowned); }

  // Can this creature become renowned right now? (battlefield + has renown + not yet renowned)
  function canRenown(game, id, ctx) {
    var c = game.cards[id];
    if (!c) return { ok: false, reason: "no such card" };
    if (c.zone !== "battlefield") return { ok: false, reason: "not on the battlefield" };
    var n = renownValue(defOf(game, id, ctx));
    if (n == null) return { ok: false, reason: "no renown" };
    if (c.renowned) return { ok: false, reason: "already renowned" };
    return { ok: true, n: n };
  }

  // Events for "dealt combat damage to a player": N +1/+1 counters + the renowned flag.
  function renownEvents(game, id, ctx) {
    var chk = canRenown(game, id, ctx);
    if (!chk.ok) return [];
    var out = [];
    if (chk.n > 0) out.push({ t: "card_counter", instanceId: id, kind: "+1/+1", delta: chk.n });
    out.push({ t: "__set", cards: [{ id: id, fields: { renowned: true } }] });
    return out;
  }

  return { renownValue: renownValue, isRenowned: isRenowned, canRenown: canRenown, renownEvents: renownEvents };
});

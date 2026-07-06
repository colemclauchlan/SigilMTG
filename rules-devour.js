/*
 * rules-devour.js — devour (CR 702.83). PURE.
 * Browser global (window.MTGRulesDevour) + Node module. "Devour N: as this enters, you may sacrifice any
 * number of creatures. It enters with N +1/+1 counters on it for each creature sacrificed this way." This
 * module owns N, validates the chosen sacrifices, and emits the sacrifices + the counters.
 *
 *   def.devour = 1     // N (+1/+1 counters per creature devoured)
 *
 *   devourN(def)                                  -> N, or null
 *   canDevour(game, cardId, seat, sacIds, ctx)    -> { ok, reason }  (all sacrifices are your creatures)
 *   devourEvents(game, cardId, sacIds, ctx)       -> [sac each…, card_counter +1/+1 (N × count)]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDevour = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function devourN(def) { return (def && def.devour != null) ? def.devour : null; }

  function canDevour(game, cardId, seat, sacIds, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    if (devourN(Cards && Cards.get((game.cards[cardId] || {}).name)) == null) return { ok: false, reason: "no devour" };
    sacIds = sacIds || [];
    for (var i = 0; i < sacIds.length; i++) {
      var s = game.cards[sacIds[i]];
      if (!s || s.zone !== "battlefield" || owner(s) !== seat || !isCreature(Cards && Cards.get(s.name))) return { ok: false, reason: "you may only sacrifice creatures you control" };
      if (sacIds[i] === cardId) return { ok: false, reason: "the devouring creature can't devour itself" };
    }
    return { ok: true };
  }

  // sacrifice the chosen creatures; the devouring creature enters with N counters per creature devoured
  function devourEvents(game, cardId, sacIds, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var n = devourN(Cards && Cards.get(c.name)); if (n == null) return [];
    sacIds = sacIds || [];
    var events = sacIds.map(function (id) { return { t: "card_move", instanceId: id, toZone: "graveyard" }; });
    var counters = n * sacIds.length;
    if (counters > 0) events.push({ t: "card_counter", instanceId: cardId, kind: "+1/+1", delta: counters });
    return events;
  }

  return { devourN: devourN, canDevour: canDevour, devourEvents: devourEvents };
});

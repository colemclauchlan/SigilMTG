/*
 * rules-champion.js — champion (CR 702.71). PURE.
 * Browser global (window.MTGRulesChampion) + Node module. "Champion an [object]: when this permanent enters,
 * sacrifice it unless you exile another [object] you control. When this permanent leaves the battlefield,
 * return the exiled card to the battlefield." This module owns the exile-on-enter and return-on-leave events.
 *
 *   def.champion = "creature"     // the kind of permanent it champions (any creature by default)
 *
 *   championType(def)                                       -> the champion type string, or null
 *   canChampion(game, championId, exileId, seat, ctx)       -> { ok, reason }  (exile another one you control)
 *   championEnterEvents(game, championId, exileId, ctx)     -> [exileId→exile, __set championed]
 *   championLeaveEvents(game, championId, ctx)              -> [championed card exile→battlefield]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesChampion = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }
  function isCreature(def) { return !!(def && def.types && def.types.indexOf("creature") >= 0); }

  function championType(def) { return (def && def.champion) ? def.champion : null; }

  function canChampion(game, championId, exileId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var champ = game.cards[championId];
    if (!champ || !championType(Cards && Cards.get(champ.name))) return { ok: false, reason: "no champion" };
    if (exileId === championId) return { ok: false, reason: "must champion ANOTHER permanent" };
    var ex = game.cards[exileId];
    if (!ex || ex.zone !== "battlefield" || owner(ex) !== seat) return { ok: false, reason: "exile another permanent you control" };
    if (!isCreature(Cards && Cards.get(ex.name))) return { ok: false, reason: "the championed permanent must be a creature" };
    return { ok: true };
  }

  // as the champion enters: exile the chosen permanent and remember it
  function championEnterEvents(game, championId, exileId, ctx) {
    if (!game.cards[championId] || !game.cards[exileId]) return [];
    return [
      { t: "card_move", instanceId: exileId, toZone: "exile" },
      { t: "__set", cards: [{ id: championId, fields: { championed: exileId } }] }
    ];
  }

  // when the champion leaves: return the exiled card to the battlefield
  function championLeaveEvents(game, championId, ctx) {
    var champ = game.cards[championId];
    if (!champ || !champ.championed) return [];
    var ex = game.cards[champ.championed];
    if (!ex) return [];
    return [
      { t: "card_move", instanceId: champ.championed, toZone: "battlefield" },
      { t: "__set", cards: [{ id: championId, fields: { championed: null } }] }
    ];
  }

  return { championType: championType, canChampion: canChampion, championEnterEvents: championEnterEvents, championLeaveEvents: championLeaveEvents };
});

/*
 * rules-sickness.js — summoning sickness & "can attack". PURE (drives engine-core).
 * Browser global (window.MTGRulesSickness) + Node module. A creature can't attack (or use {T} abilities)
 * unless its controller has controlled it continuously since their most recent turn began — or it has
 * haste (CR 302.6 / 508.1a). Modeled with a "sick" counter: set when a creature enters, cleared at the
 * controller's untap step. canAttack() also reads EFFECTIVE abilities so GRANTED haste (e.g. from a
 * lord) counts. Read helpers + the two engine mutators.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSickness = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function isSick(card) { return !!(card && card.counters && card.counters.sick); }

  function abilitiesOf(game, cardId, ctx) {
    var KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, cardId, ctx); if (e) return e.abilities || []; }
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[cardId], def = (Cards && c) ? Cards.get(c.name) : null;
    return (def && def.abilities) || [];
  }

  // mark a creature summoning-sick (call when it enters the battlefield)
  function markSick(E, estate, cardId) {
    var c = estate.game.cards[cardId];
    if (c && !isSick(c)) return E.dispatch(estate, { t: "card_counter", instanceId: cardId, kind: "sick", delta: 1 });
    return estate;
  }
  // clear sickness for a seat's creatures (call at their untap step)
  function clearSickness(E, estate, seat) {
    var s = estate;
    for (var id in s.game.cards) {
      var c = s.game.cards[id];
      if (c.controllerSeat === seat && c.zone === "battlefield" && isSick(c)) s = E.dispatch(s, { t: "card_counter", instanceId: id, kind: "sick", delta: -c.counters.sick });
    }
    return s;
  }

  function canAttack(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[cardId];
    if (!c || c.zone !== "battlefield" || c.tapped) return false;
    var def = Cards ? Cards.get(c.name) : null;
    if (!def || def.types.indexOf("creature") < 0) return false;
    if (abilitiesOf(game, cardId, ctx).indexOf("haste") >= 0) return true;
    return !isSick(c);
  }

  return { markSick: markSick, clearSickness: clearSickness, isSick: isSick, canAttack: canAttack };
});

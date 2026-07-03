/*
 * rules-bargain.js — bargain (CR 702.170). PURE.
 * Browser global (window.MTGRulesBargain) + Node module. "You may sacrifice an artifact, enchantment,
 * or token as you cast this spell." Bargain is an OPTIONAL additional cost: paying it doesn't change the
 * mana cost, but the spell's effect checks whether it "was bargained" for a bonus. This module validates
 * a candidate sacrifice (must be an artifact, enchantment, or ANY token you control) and emits the sac
 * event plus a `bargained` marker the resolving effect reads.
 *
 *   canBargainSacrifice(game, casterSeat, sacId, ctx)  -> { ok, reason }
 *   bargainTargets(game, casterSeat, ctx)              -> [ids] you could sacrifice
 *   bargainEvents(game, spellId, casterSeat, sacId, ctx)
 *                                                      -> [sac→graveyard, __set bargained:true] | []
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesBargain = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function defOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    return (c && Cards && Cards.get(c.name)) || null;
  }

  // a bargainable permanent: an artifact, an enchantment, or any token (regardless of type)
  function isBargainable(game, id, ctx) {
    var c = game.cards[id]; if (!c) return false;
    if (c.token) return true;
    var def = defOf(game, id, ctx); if (!def) return false;
    var types = def.types || [];
    return types.indexOf("artifact") >= 0 || types.indexOf("enchantment") >= 0;
  }

  function canBargainSacrifice(game, casterSeat, sacId, ctx) {
    var c = game.cards[sacId]; if (!c) return { ok: false, reason: "no such permanent" };
    if (c.zone !== "battlefield") return { ok: false, reason: "must be on the battlefield" };
    if (c.controllerSeat !== casterSeat) return { ok: false, reason: "you can only sacrifice your own permanent" };
    if (!isBargainable(game, sacId, ctx)) return { ok: false, reason: "must be an artifact, enchantment, or token" };
    return { ok: true };
  }

  function bargainTargets(game, casterSeat, ctx) {
    var out = [];
    Object.keys(game.cards).sort().forEach(function (id) {
      var c = game.cards[id];
      if (c && c.zone === "battlefield" && c.controllerSeat === casterSeat && isBargainable(game, id, ctx)) out.push(id);
    });
    return out;
  }

  // pay the bargain cost: sacrifice the chosen permanent and mark the spell as bargained.
  // sacId == null -> the optional cost was declined (empty event list, spell still "not bargained").
  function bargainEvents(game, spellId, casterSeat, sacId, ctx) {
    if (sacId == null) return [];
    var chk = canBargainSacrifice(game, casterSeat, sacId, ctx); if (!chk.ok) return [];
    return [
      { t: "card_move", instanceId: sacId, toZone: "graveyard" },
      { t: "__set", cards: [{ id: spellId, fields: { bargained: true } }] }
    ];
  }

  return { isBargainable: isBargainable, canBargainSacrifice: canBargainSacrifice, bargainTargets: bargainTargets, bargainEvents: bargainEvents };
});

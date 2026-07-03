/*
 * rules-targeting.js — target legality (CR 115). PURE.
 * Browser global (window.MTGRulesTargeting) + Node module. Given a target spec and the board,
 * lists the legal targets and validates a chosen target. Read-only; nothing is mutated.
 *
 *   spec = "any" | "player" | "creature" | "permanent" | "creature-or-player"
 *        | { type: <one of the above>, controller: "you" | "opponent" | "any" }
 *   target = { kind: "player", seat } | { kind: "card", instanceId }
 *   ctx = { Cards, you }   // Cards = card-defs (to know which permanents are creatures); you = caster seat
 *
 * "any" = any target = a creature or a player (planeswalkers/battles deferred). Extra restrictions
 * (power/toughness/color/"another", protection, hexproof, shroud) are deferred and documented.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesTargeting = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function isCreature(game, id, Cards) {
    var c = game.cards[id];
    if (!c || c.zone !== "battlefield") return false;
    var def = Cards ? Cards.get(c.name) : null;
    return def ? def.types.indexOf("creature") >= 0 : !!c.isCreature;
  }

  function legalTargets(game, spec, ctx) {
    ctx = ctx || {};
    var Cards = pick(ctx, "Cards", "MTGCards"), you = ctx.you;
    spec = (typeof spec === "string") ? { type: spec } : (spec || {});
    var type = spec.type, ctrl = spec.controller || "any", out = [];

    function pushPlayers() {
      for (var s = 0; s < game.seats; s++) {
        if (ctrl === "you" && s !== you) continue;
        if (ctrl === "opponent" && s === you) continue;
        out.push({ kind: "player", seat: s });
      }
    }
    function pushCards(filter) {
      for (var id in game.cards) {
        var c = game.cards[id];
        if (c.zone !== "battlefield" || !filter(id)) continue;
        if (ctrl === "you" && c.controllerSeat !== you) continue;
        if (ctrl === "opponent" && c.controllerSeat === you) continue;
        out.push({ kind: "card", instanceId: id });
      }
    }

    if (type === "player") pushPlayers();
    else if (type === "creature") pushCards(function (id) { return isCreature(game, id, Cards); });
    else if (type === "permanent") pushCards(function () { return true; });
    else if (type === "any" || type === "creature-or-player") { pushCards(function (id) { return isCreature(game, id, Cards); }); pushPlayers(); }
    return out;
  }

  function isLegalTarget(game, spec, target, ctx) {
    if (!target) return false;
    return legalTargets(game, spec, ctx).some(function (t) {
      return t.kind === target.kind && t.seat === target.seat && t.instanceId === target.instanceId;
    });
  }

  return { legalTargets: legalTargets, isLegalTarget: isLegalTarget };
});

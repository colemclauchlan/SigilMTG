/*
 * rules-goad.js — goad (CR 701.39). PURE. A signature multiplayer/Commander mechanic.
 * Browser global (window.MTGRulesGoad) + Node module. A goaded creature "attacks each combat if able and
 * attacks a player other than the one who goaded it if able." Modeled with a `goadedBy` seat marker on the
 * card; this validates a declared attack plan against both requirements (multiplayer-aware — the
 * "someone other than the goader" rule only bites when another opponent is actually attackable).
 *
 *   setGoad(id, bySeat)                       -> event to goad a creature (until that player's next turn)
 *   mustAttack(game, id, ctx)                 -> is this goaded creature REQUIRED to attack (and able)?
 *   validateAttackPlan(game, seat, plan, ctx) -> { ok, violations:[{id,reason}] }   plan entry: {attacker, defender}
 *   clearGoad(game, bySeat)                   -> events to end goad from that player (their turn ended)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesGoad = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function setGoad(id, bySeat) { return { t: "__set", cards: [{ id: id, fields: { goadedBy: bySeat } }] }; }
  function isGoaded(game, id) { var c = game.cards[id]; return !!(c && c.goadedBy != null); }

  function canAttack(game, id, ctx) {
    var Sick = pick(ctx, "Sickness", "MTGRulesSickness"), Cards = pick(ctx, "Cards", "MTGCards");
    if (Sick && Sick.canAttack) return Sick.canAttack(game, id, ctx);
    var c = game.cards[id], def = Cards && Cards.get(c.name);
    return !!(c && c.zone === "battlefield" && !c.tapped && def && def.types.indexOf("creature") >= 0);
  }

  // a goaded creature that is able to attack MUST attack
  function mustAttack(game, id, ctx) { return isGoaded(game, id) && canAttack(game, id, ctx); }

  // other opponents this creature's controller has, besides the goader (multiplayer goad nuance)
  function otherDefendersExist(game, controllerSeat, goaderSeat) {
    for (var s = 0; s < game.seats; s++) { if (s !== controllerSeat && s !== goaderSeat) return true; }
    return false;
  }

  function validateAttackPlan(game, seat, plan, ctx) {
    plan = plan || [];
    var attacking = {}; plan.forEach(function (p) { attacking[p.attacker] = p; });
    var violations = [];
    // requirement 1: every goaded, able creature you control must be attacking
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.zone !== "battlefield" || c.controllerSeat !== seat) continue;
      if (mustAttack(game, id, ctx) && !attacking[id]) violations.push({ id: id, reason: "goaded creature must attack if able" });
    }
    // requirement 2: a goaded creature must attack a player OTHER than its goader, if able
    plan.forEach(function (p) {
      var c = game.cards[p.attacker];
      if (c && c.goadedBy != null && p.defender === c.goadedBy && otherDefendersExist(game, c.controllerSeat, c.goadedBy))
        violations.push({ id: p.attacker, reason: "goaded creature can't attack its goader while another player is attackable" });
    });
    return { ok: violations.length === 0, violations: violations };
  }

  function clearGoad(game, bySeat) {
    var out = [];
    for (var id in game.cards) { if (game.cards[id].goadedBy === bySeat) out.push({ t: "__set", cards: [{ id: id, fields: { goadedBy: null } }] }); }
    return out;
  }

  return { setGoad: setGoad, isGoaded: isGoaded, mustAttack: mustAttack, validateAttackPlan: validateAttackPlan, clearGoad: clearGoad };
});

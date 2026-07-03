/*
 * rules-annihilator.js — annihilator (CR 702.85). PURE.
 * Browser global (window.MTGRulesAnnihilator) + Node module. "Annihilator N — Whenever this creature
 * attacks, the defending player sacrifices N permanents." This fires on the attack trigger (before
 * blockers) regardless of whether the creature is blocked. We read annihilator N from EFFECTIVE
 * abilities (so a granted "annihilator 1" counts), find the defending seat, then pick N permanents the
 * defender controls to sacrifice via a deterministic policy.
 *
 * The default `chooseSacrifices` policy is "lowest value first" (a permanent's value = power+toughness for
 * creatures, else 0; ties broken by instance id) so results are stable & replayable. In a real game the
 * defending player chooses; this policy is what the engine uses for solo/auto play and tests.
 *
 *   annihilatorN(game, attackerId, ctx)            -> N (0 if the attacker has no annihilator)
 *   defendingSeat(game, attackerId)                -> the seat that must sacrifice (the attacker's target/defender)
 *   chooseSacrifices(game, defenderSeat, n, ctx)   -> [ids] of permanents to sacrifice (deterministic)
 *   annihilatorEvents(game, attackerId, ctx)       -> [card_move ->graveyard events] for the chosen sacrifices
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAnnihilator = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }

  // Annihilator N from an abilities list. Supports "annihilator" (=1), "annihilator 2", "annihilator:3".
  function annNFromAbilities(ab) {
    var n = 0;
    (ab || []).forEach(function (a) {
      if (typeof a !== "string") return;
      var m = /^annihilator(?:[\s:]+(\d+))?$/.exec(a.trim().toLowerCase());
      if (m) n = Math.max(n, m[1] != null ? +m[1] : 1);
    });
    return n;
  }
  function annihilatorN(game, attackerId, ctx) { return annNFromAbilities(abilitiesOf(game, attackerId, ctx)); }

  // The defending player: an explicit attack target seat, else "the other player" in a 2-player game.
  function defendingSeat(game, attackerId) {
    var c = game.cards[attackerId]; if (!c) return null;
    if (c.attackTargetSeat != null) return c.attackTargetSeat;
    if (c.defendingSeat != null) return c.defendingSeat;
    var seats = game.seats || (game.players ? game.players.length : 0);
    if (seats === 2) return c.controllerSeat === 0 ? 1 : 0;
    return null;
  }

  function permValue(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[id], def = Cards && Cards.get(c.name);
    if (!def) return 0;
    var p = def.power != null ? def.power : 0, t = def.toughness != null ? def.toughness : 0;
    return p + t;
  }

  // Deterministic "lowest value first" sacrifice policy over the defender's battlefield permanents.
  function chooseSacrifices(game, defenderSeat, n, ctx) {
    if (defenderSeat == null || n <= 0) return [];
    var ids = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.zone === "battlefield" && c.controllerSeat === defenderSeat) ids.push(id);
    }
    ids.sort(function (a, b) {
      var va = permValue(game, a, ctx), vb = permValue(game, b, ctx);
      if (va !== vb) return va - vb;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    return ids.slice(0, n);
  }

  function annihilatorEvents(game, attackerId, ctx) {
    var n = annihilatorN(game, attackerId, ctx);
    if (n <= 0) return [];
    var seat = defendingSeat(game, attackerId);
    return chooseSacrifices(game, seat, n, ctx).map(function (id) {
      return { t: "card_move", instanceId: id, toZone: "graveyard" };
    });
  }

  return {
    pick: pick, abilitiesOf: abilitiesOf, annNFromAbilities: annNFromAbilities,
    annihilatorN: annihilatorN, defendingSeat: defendingSeat,
    chooseSacrifices: chooseSacrifices, annihilatorEvents: annihilatorEvents
  };
});

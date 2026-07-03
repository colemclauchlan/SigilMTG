/*
 * rules-fabricate.js — fabricate N (CR 702.122). PURE.
 * Browser global (window.MTGRulesFabricate) + Node module. "When this permanent enters the battlefield,
 * put N +1/+1 counters on it OR create N 1/1 colorless Servo artifact creature tokens." The choice is
 * made once on ETB; counters go on the fabricator itself, tokens are separate permanents under its
 * controller. This module is a pure decision layer: it reads `def.fabricate` (an integer N) and emits
 * the events for the chosen mode. autoChoice banks counters when the creature can profit from being
 * bigger (its own P/T matter), else spreads out into Servos for a wider board.
 *
 *   def.fabricate = 2;   def.abilities = [..., "fabricate"]  (either signals the ability)
 *
 *   fabricateN(game, id, ctx)                 -> N, or 0 (no fabricate)
 *   hasFabricate(game, id, ctx)               -> boolean
 *   enterEvents(game, id, choice, ctx)        -> [card_counter x N] | [token_create x N]  choice:"counters"|"servos"
 *   autoChoice(game, id, ctx)                 -> "counters" | "servos"  (deterministic policy)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesFabricate = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function defOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    return (c && Cards && Cards.get(c.name)) || null;
  }

  function fabricateN(game, id, ctx) {
    var def = defOf(game, id, ctx);
    if (!def) return 0;
    var n = def.fabricate;
    if (n == null) return 0;
    n = n | 0;
    return n > 0 ? n : 0;
  }

  function hasFabricate(game, id, ctx) {
    if (fabricateN(game, id, ctx) > 0) return true;
    var def = defOf(game, id, ctx);
    return !!(def && (def.abilities || []).indexOf("fabricate") >= 0);
  }

  function enterEvents(game, id, choice, ctx) {
    var c = game.cards[id]; if (!c) return [];
    var n = fabricateN(game, id, ctx); if (n <= 0) return [];
    if (choice === "servos") {
      var seat = c.controllerSeat, out = [];
      for (var i = 0; i < n; i++) {
        out.push({ t: "token_create", name: "Servo", controllerSeat: seat, ownerSeat: c.ownerSeat != null ? c.ownerSeat : seat,
          token: { name: "Servo", types: ["artifact", "creature"], subtypes: ["servo"], colors: [], power: 1, toughness: 1 } });
      }
      return out;
    }
    // default: counters on the fabricator itself
    return [{ t: "card_counter", instanceId: id, kind: "+1/+1", delta: n }];
  }

  // policy: keep the counters when the creature's own body matters (it's a creature that stays),
  // otherwise go wide with Servos. Simple heuristic: a creature with power >= 1 wants to grow;
  // a 0-power / defensive shell prefers extra bodies.
  function autoChoice(game, id, ctx) {
    var def = defOf(game, id, ctx);
    if (!def) return "counters";
    var p = def.power != null ? def.power : 0;
    return p >= 1 ? "counters" : "servos";
  }

  return { fabricateN: fabricateN, hasFabricate: hasFabricate, enterEvents: enterEvents, autoChoice: autoChoice };
});

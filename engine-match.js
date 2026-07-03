/*
 * engine-match.js — full auto-game WITH blocking. PURE (drives engine-core).
 * Browser global (window.MTGGameAI) + Node module. Like engine-game, but during combat the defending
 * player uses the blocking AI (rules-blocking) to assign blockers, so auto-games involve real combat
 * decisions instead of pure races. Composes rules-turn + engine-autopilot + rules-blocking +
 * rules-combat-turn, and detects a winner via the SBA detectors (engine-game.winner).
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGGameAI = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function autoTurnWithBlocks(E, estate, ctx) {
    var T = pick(ctx, "Turn", "MTGRulesTurn"), Auto = pick(ctx, "Auto", "MTGAutopilot"),
        CT = pick(ctx, "CombatTurn", "MTGCombatTurn"), Block = pick(ctx, "Blocking", "MTGRulesBlocking");
    var s = estate, seat = s.game.activeSeat, opp = (seat + 1) % s.game.seats;
    s = T.performStep(E, s, T.STEPS[0], {});   // untap
    s = T.performStep(E, s, T.STEPS[1], {});   // upkeep
    s = T.performStep(E, s, T.STEPS[2], {});   // draw
    s = T.performStep(E, s, T.STEPS[3], {});   // main1
    s = Auto.playMainPhase(E, s, seat, ctx);
    s = T.performStep(E, s, T.STEPS[4], {});   // begin combat
    s = T.performStep(E, s, T.STEPS[5], {});   // declare attackers
    var attackers = CT.declareAllAttackers(s, seat, ctx);
    var plan = Block.chooseBlocks(s.game, opp, attackers, ctx);   // defender chooses blocks
    s = CT.runCombat(E, s, opp, plan, ctx);
    s = T.performStep(E, s, T.STEPS[7], {});   // combat damage
    s = T.performStep(E, s, T.STEPS[8], {});   // end of combat
    s = T.performStep(E, s, T.STEPS[9], {});   // main2
    s = T.performStep(E, s, T.STEPS[10], {});  // end
    s = T.performStep(E, s, T.STEPS[11], {});  // cleanup
    return s;
  }

  function playMatch(E, estate, ctx, maxTurns) {
    var s = estate, Game = pick(ctx, "Game", "MTGGame"), guard = 0; maxTurns = maxTurns || 60;
    while (guard++ < maxTurns) {
      s = autoTurnWithBlocks(E, s, ctx);
      var w = Game.winner(s, ctx); if (w != null) return { estate: s, winner: w, turns: guard };
      s = E.dispatch(s, { t: "pass_turn" });
      var w2 = Game.winner(s, ctx); if (w2 != null) return { estate: s, winner: w2, turns: guard };
    }
    return { estate: s, winner: null, turns: guard };
  }

  return { autoTurnWithBlocks: autoTurnWithBlocks, playMatch: playMatch };
});

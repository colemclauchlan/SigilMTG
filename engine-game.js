/*
 * engine-game.js — full self-playing game orchestrator. PURE (drives engine-core via public API).
 * Browser global (window.MTGGame) + Node module. Ties the whole engine together into a playable
 * (auto-piloted) game: each turn runs the CR-500 steps (rules-turn), the active player casts in its
 * main phase (engine-autopilot), declares all attackers and resolves combat on the board
 * (rules-combat-turn), and a loss is detected by the state-based-action detectors (rules-sba). It
 * loops, passing the turn, until a player loses. Deterministic; no randomness beyond the seeded shuffle.
 *
 * This is the end-to-end demonstration that the engine can play. The auto-pilot policy is intentionally
 * simple (greedy: play a land, cast affordable creatures, swing with everything). Summoning sickness,
 * blocking decisions, and instant-speed responses are deferred — this proves the orchestration.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGGame = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  // run the active player's full turn
  function autoTurn(E, estate, ctx) {
    var T = pick(ctx, "Turn", "MTGRulesTurn"), Auto = pick(ctx, "Auto", "MTGAutopilot"), CT = pick(ctx, "CombatTurn", "MTGCombatTurn");
    var s = estate, seat = s.game.activeSeat, opp = (seat + 1) % s.game.seats;
    s = T.performStep(E, s, T.STEPS[0], {});   // untap
    s = T.performStep(E, s, T.STEPS[1], {});   // upkeep
    s = T.performStep(E, s, T.STEPS[2], {});   // draw
    s = T.performStep(E, s, T.STEPS[3], {});   // precombat main
    s = Auto.playMainPhase(E, s, seat, ctx);   // play land + cast affordable creatures
    s = T.performStep(E, s, T.STEPS[4], {});   // begin combat
    s = T.performStep(E, s, T.STEPS[5], {});   // declare attackers
    s = CT.runCombat(E, s, opp, CT.declareAllAttackers(s, seat, ctx), ctx); // apply combat to the board
    s = T.performStep(E, s, T.STEPS[7], {});   // combat damage step (already applied)
    s = T.performStep(E, s, T.STEPS[8], {});   // end of combat
    s = T.performStep(E, s, T.STEPS[9], {});   // postcombat main
    s = T.performStep(E, s, T.STEPS[10], {});  // end step
    s = T.performStep(E, s, T.STEPS[11], {});  // cleanup
    return s;
  }

  // 2+ player win check via state-based-action loss detection (last player standing)
  function winner(estate, ctx) {
    var SBA = pick(ctx, "SBA", "MTGRulesSBA");
    var lost = {};
    SBA.detectAll(estate.game).forEach(function (f) { if (f.kind === "player_loss") lost[f.seat] = true; });
    var alive = [];
    for (var s = 0; s < estate.game.seats; s++) if (!lost[s]) alive.push(s);
    if (estate.game.seats > 1 && alive.length === 1) return alive[0];
    return null;
  }

  // play turns (auto) until someone wins or maxTurns is reached
  function playGame(E, estate, ctx, maxTurns) {
    var s = estate, guard = 0; maxTurns = maxTurns || 50;
    while (guard++ < maxTurns) {
      s = autoTurn(E, s, ctx);
      var w = winner(s, ctx); if (w != null) return { estate: s, winner: w, turns: guard };
      s = E.dispatch(s, { t: "pass_turn" });
      var w2 = winner(s, ctx); if (w2 != null) return { estate: s, winner: w2, turns: guard };
    }
    return { estate: s, winner: null, turns: guard };
  }

  return { autoTurn: autoTurn, winner: winner, playGame: playGame };
});

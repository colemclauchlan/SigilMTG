/*
 * rules-daynight.js — the day/night designation (CR 726). PURE.
 * Browser global (window.MTGRulesDayNight) + Node module. The game is "day", "night", or neither. When it
 * first matters it becomes day; thereafter, at the start of a turn: if it's day and the player whose turn
 * it WAS cast no spells, it becomes night; if it's night and that player cast two or more spells, it
 * becomes day. Werewolves track this (front by day, back by night). State storage is the caller's (a global
 * field), so this is pure transition logic + the werewolf transform events for a state change.
 *
 *   firstBecomes()                              -> "day"
 *   nextState(current, activePlayerCastCount)    -> the new state at the start of the next turn
 *   isNight(state) / werewolfTransformed(state)
 *   transformEventsFor(game, toState, ctx)       -> [card_transform …] for werewolves that must flip
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDayNight = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function firstBecomes() { return "day"; }
  function isNight(state) { return state === "night"; }
  function werewolfTransformed(state) { return state === "night"; }   // werewolves are on their back (wolf) face at night

  // CR 726.2/726.3: day -> night if the active player cast 0 spells; night -> day if they cast 2+.
  function nextState(current, activePlayerCastCount) {
    if (current === "day" && (activePlayerCastCount || 0) === 0) return "night";
    if (current === "night" && (activePlayerCastCount || 0) >= 2) return "day";
    return current;
  }

  // when the state changes, werewolves flip to match it (front by day, back by night)
  function transformEventsFor(game, toState, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), wantBack = werewolfTransformed(toState), out = [];
    for (var id in game.cards) {
      var c = game.cards[id]; if (c.zone !== "battlefield") continue;
      var def = Cards && Cards.get(c.name); if (!def || !def.werewolf) continue;
      if (!!c.flipped !== wantBack) out.push({ t: "card_transform", instanceId: id });
    }
    return out;
  }

  return { firstBecomes: firstBecomes, isNight: isNight, werewolfTransformed: werewolfTransformed, nextState: nextState, transformEventsFor: transformEventsFor };
});

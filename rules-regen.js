/*
 * rules-regen.js — regeneration (CR 701.15). PURE.
 * Browser global (window.MTGRulesRegen) + Node module. Regeneration is a one-shot "destroy" SHIELD:
 * "the next time this would be destroyed this turn, instead tap it, remove it from combat, and remove all
 * damage from it." Modeled as a `regen` counter; `applyDestroy` consumes one shield (and returns the
 * regenerate events) instead of moving the creature to the graveyard. Composes with combat & removal —
 * call it wherever a creature would be destroyed (distinct from indestructible, which is unlimited and
 * needs no shield).
 *
 *   addShield(id)                 -> event to grant one regeneration shield (e.g. "{G}: regenerate")
 *   applyDestroy(game, id, ctx)   -> { regenerated:bool, events:[…] }  (regen events, or a move-to-graveyard)
 *
 * Shields are cleared at end of turn by the caller (a per-turn cleanup), like real regeneration.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesRegen = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function addShield(id) { return { t: "card_counter", instanceId: id, kind: "regen", delta: 1 }; }
  function hasShield(game, id) { var c = game.cards[id]; return !!(c && c.counters && c.counters.regen > 0); }

  // what happens when this creature WOULD be destroyed: regenerate (if shielded) or go to the graveyard
  function applyDestroy(game, id, ctx) {
    var c = game.cards[id];
    if (!c) return { regenerated: false, events: [] };
    if (c.counters && c.counters.regen > 0) {
      var events = [
        { t: "card_counter", instanceId: id, kind: "regen", delta: -1 },   // consume one shield
        { t: "card_tap", instanceId: id, tapped: true },                    // tap it
        { t: "__set", cards: [{ id: id, fields: { attacking: false } }] }   // remove from combat
      ];
      if (c.counters.damage) events.push({ t: "card_counter", instanceId: id, kind: "damage", delta: -c.counters.damage }); // remove all damage
      return { regenerated: true, events: events };
    }
    return { regenerated: false, events: [{ t: "card_move", instanceId: id, toZone: "graveyard" }] };
  }

  // clear all regeneration shields (call at end of turn)
  function clearShields(game) {
    var out = [];
    for (var id in game.cards) { var c = game.cards[id]; if (c.counters && c.counters.regen) out.push({ t: "card_counter", instanceId: id, kind: "regen", delta: -c.counters.regen }); }
    return out;
  }

  return { addShield: addShield, hasShield: hasShield, applyDestroy: applyDestroy, clearShields: clearShields };
});

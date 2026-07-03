/*
 * rules-modal.js — modal spells & abilities ("choose one/two", CR 700.2). PURE.
 * Browser global (window.MTGRulesModal) + Node module. Charms and commands pick one (or more) of several
 * modes; this validates the choice and assembles the chosen modes' effects (with the usual target/seat
 * binding), ready to put on the stack like any spell.
 *
 *   def.spell = { modal:true, chooseCount?:1, modes:[ { label?, effects:[…] }, … ] }
 *
 *   modesOf(def)                              -> the mode list
 *   validChoice(def, indices)                  -> are these the right number of distinct, in-range modes?
 *   chooseEffects(def, indices, card, target)  -> the combined, bound effects of the chosen modes
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesModal = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function modesOf(def) { return (def && def.spell && def.spell.modes) || (def && def.modes) || []; }
  function chooseCount(def) { return (def && def.spell && def.spell.chooseCount) || (def && def.chooseCount) || 1; }

  function validChoice(def, indices) {
    var modes = modesOf(def), want = chooseCount(def), seen = {};
    if (!indices || indices.length !== want) return false;
    for (var i = 0; i < indices.length; i++) {
      var ix = indices[i];
      if (ix < 0 || ix >= modes.length || seen[ix]) return false;   // in range + distinct
      seen[ix] = true;
    }
    return true;
  }

  function bind(effects, card, target) {
    return (effects || []).map(function (e) {
      var o = {}; for (var k in e) o[k] = e[k];
      if (o.seat === "controller" && card) o.seat = card.controllerSeat;
      else if (o.seat === "owner" && card) o.seat = card.ownerSeat;
      else if (o.seat === "target" && target && target.kind === "player") o.seat = target.seat;
      if (o.instanceId === "target" && target && target.kind === "card") o.instanceId = target.instanceId;
      return o;
    });
  }

  function chooseEffects(def, indices, card, target) {
    var modes = modesOf(def), out = [];
    (indices || []).forEach(function (ix) { if (modes[ix]) out = out.concat(bind(modes[ix].effects, card, target)); });
    return out;
  }

  return { modesOf: modesOf, chooseCount: chooseCount, validChoice: validChoice, chooseEffects: chooseEffects };
});

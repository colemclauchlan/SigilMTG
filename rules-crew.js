/*
 * rules-crew.js — Vehicles & crew (CR 702.122 / 301.7). PURE.
 * Browser global (window.MTGRulesCrew) + Node module. "Crew N: Tap any number of untapped creatures you
 * control with total power N or greater: this Vehicle becomes an artifact creature until end of turn."
 * Validates the crew, emits the tap events + a `crewed` flag, and exposes whether a Vehicle is currently
 * a creature. Uses EFFECTIVE power (rules-keywords) so buffs count toward crewing.
 *
 *   def (vehicle) = { types:["artifact","vehicle"], crew:3, power:5, toughness:5 }
 *
 *   crewPower(game, creatureIds, ctx)         -> total effective power of those creatures
 *   canCrew(game, vehicleId, crewIds, ctx)     -> { ok, reason }
 *   crewEvents(game, vehicleId, crewIds, ctx)  -> [tap each crewer, set the Vehicle crewed]
 *   isCreature(game, id, ctx)                  -> is this a creature right now (incl. a crewed Vehicle)?
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesCrew = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function powerOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    // attachment-aware so an equipped creature crews with its boosted power (e.g. Bonesplitter)
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea && ea.power != null) return ea.power; }
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e && e.power != null) return e.power; }
    var def = Cards && Cards.get(game.cards[id].name); return def ? (def.power || 0) : 0;
  }

  function crewPower(game, ids, ctx) {
    var total = 0; (ids || []).forEach(function (id) { var c = game.cards[id]; if (c && c.zone === "battlefield") total += powerOf(game, id, ctx); }); return total;
  }

  function canCrew(game, vehicleId, crewIds, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), v = game.cards[vehicleId];
    if (!v || v.zone !== "battlefield") return { ok: false, reason: "no such vehicle" };
    var vdef = Cards && Cards.get(v.name);
    if (!vdef || vdef.types.indexOf("vehicle") < 0) return { ok: false, reason: "not a Vehicle" };
    for (var i = 0; i < (crewIds || []).length; i++) {
      var c = game.cards[crewIds[i]], def = c && Cards && Cards.get(c.name);
      if (!c || c.zone !== "battlefield" || c.controllerSeat !== v.controllerSeat) return { ok: false, reason: "crew must be your battlefield permanents" };
      if (c.tapped) return { ok: false, reason: "crew creatures must be untapped" };
      if (!def || def.types.indexOf("creature") < 0) return { ok: false, reason: "only creatures can crew" };
    }
    if (crewPower(game, crewIds, ctx) < (vdef.crew || 0)) return { ok: false, reason: "not enough power to crew" };
    return { ok: true };
  }

  function crewEvents(game, vehicleId, crewIds, ctx) {
    var events = (crewIds || []).map(function (id) { return { t: "card_tap", instanceId: id, tapped: true }; });
    events.push({ t: "__set", cards: [{ id: vehicleId, fields: { crewed: true } }] });
    return events;
  }

  function isCreature(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id]; if (!c) return false;
    var def = Cards && Cards.get(c.name); if (!def) return false;
    if (def.types.indexOf("creature") >= 0) return true;
    return def.types.indexOf("vehicle") >= 0 && !!c.crewed;     // a crewed Vehicle is a creature
  }

  return { crewPower: crewPower, canCrew: canCrew, crewEvents: crewEvents, isCreature: isCreature };
});

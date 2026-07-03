/*
 * rules-landfall.js — landfall (ability word; CR 207.2c / triggers off a land ETB). PURE.
 * Browser global (window.MTGRulesLandfall) + Node module. "Landfall" is an ability word with no rules
 * meaning of its own: it marks triggered abilities that read "Whenever a land you control enters, …".
 * Given a land that just entered the battlefield, this finds every permanent with a landfall ability
 * that the LAND'S CONTROLLER controls — those are the abilities that trigger. Nothing is mutated; the
 * caller turns the returned sources into stack triggers (rules-triggers / engine-core).
 *
 *   isLand(game, id, ctx)                  -> true if that card's definition is a land
 *   landfallTriggers(game, enteringLandId, ctx) -> [{ source, controllerSeat }] one per landfall permanent
 *
 * A permanent "has landfall" if its def lists "landfall" in abilities OR carries a def.triggers entry
 * whose `on` is "landfall". (Matching a specific quality of the land that entered is deferred.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesLandfall = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function defOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game && game.cards && game.cards[id];
    if (!c) return null;
    return Cards && Cards.get(c.name);
  }

  function isLand(game, id, ctx) {
    var def = defOf(game, id, ctx);
    return !!def && (def.types || []).indexOf("land") >= 0;
  }

  // does a card definition carry a landfall ability?
  function defHasLandfall(def) {
    if (!def) return false;
    if ((def.abilities || []).indexOf("landfall") >= 0) return true;
    var trg = def.triggers || [];
    for (var i = 0; i < trg.length; i++) { if (trg[i] && trg[i].on === "landfall") return true; }
    return false;
  }

  // landfall abilities that fire when `enteringLandId` enters: those of the land's controller.
  function landfallTriggers(game, enteringLandId, ctx) {
    var out = [];
    if (!isLand(game, enteringLandId, ctx)) return out;
    var land = game.cards[enteringLandId];
    var controller = land.controllerSeat != null ? land.controllerSeat : land.ownerSeat;
    var cards = (game && game.cards) || {};
    for (var id in cards) {
      var c = cards[id];
      if (!c || c.zone !== "battlefield" || c.controllerSeat !== controller) continue;
      if (defHasLandfall(defOf(game, id, ctx))) out.push({ source: id, controllerSeat: controller });
    }
    return out;
  }

  return { isLand: isLand, landfallTriggers: landfallTriggers, defHasLandfall: defHasLandfall };
});

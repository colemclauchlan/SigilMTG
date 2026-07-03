/*
 * rules-fight.js — the "fight" action (CR 701.12). PURE (drives engine-core).
 * Browser global (window.MTGRulesFight) + Node module. Two creatures each deal damage equal to their
 * EFFECTIVE power to the other; deathtouch makes any amount lethal; survivors keep marked damage;
 * lethally-damaged creatures go to the graveyard. Uses rules-keywords/rules-layers for effective P/T
 * and abilities (so counters, anthems, and granted deathtouch count). Returns { estate, ok, aDied, bDied }.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesFight = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function kw(c, k) { return c && (c.abilities || []).indexOf(k) >= 0; }

  function eff(game, id, ctx) {
    var KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e) { e.id = id; return e; } }
    var Cards = pick(ctx, "Cards", "MTGCards"), Layers = pick(ctx, "Layers", "MTGRulesLayers"), c = game.cards[id];
    if (!c) return null; var def = Cards ? Cards.get(c.name) : null; if (!def || def.power == null) return null;
    var x = Layers.computeEffectiveState(Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat }), []); x.id = id; return x;
  }

  function lethalFrom(source, victim) {
    if ((source.power || 0) <= 0) return false;
    return (source.power >= victim.toughness) || kw(source, "deathtouch");
  }
  function addDamage(E, estate, id, amount) {
    if (amount <= 0) return estate;
    var card = estate.game.cards[id], cur = (card.counters && card.counters.damage) || 0;
    return E.dispatch(estate, { t: "card_counter", instanceId: id, kind: "damage", delta: amount });
  }

  function fight(E, estate, idA, idB, ctx) {
    var a = eff(estate.game, idA, ctx), b = eff(estate.game, idB, ctx);
    if (!a || !b) return { estate: estate, ok: false, reason: "not a creature" };
    var s = estate;
    var aDies = lethalFrom(b, a), bDies = lethalFrom(a, b);
    if (!aDies && (b.power || 0) > 0) s = addDamage(E, s, idA, b.power);
    if (!bDies && (a.power || 0) > 0) s = addDamage(E, s, idB, a.power);
    if (aDies && s.game.cards[idA]) s = E.dispatch(s, { t: "card_move", instanceId: idA, toZone: "graveyard" });
    if (bDies && s.game.cards[idB]) s = E.dispatch(s, { t: "card_move", instanceId: idB, toZone: "graveyard" });
    return { estate: s, ok: true, aDied: aDies, bDied: bDies };
  }

  return { fight: fight, effective: eff };
});

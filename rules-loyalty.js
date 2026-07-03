/*
 * rules-loyalty.js — planeswalkers & loyalty abilities. PURE (drives engine-core).
 * Browser global (window.MTGRulesLoyalty) + Node module. A planeswalker enters with starting loyalty
 * (a "loyalty" counter); a loyalty ability costs +N/-N loyalty (you can't pay below 0) and its effect
 * goes on the stack; a planeswalker at 0 loyalty is destroyed (an SBA — reported by deadPlaneswalkers).
 *
 *   def = { types:["planeswalker"], subtypes:["chandra"], loyalty: 4,
 *           loyaltyAbilities: [ { cost:+1, effects:[…] }, { cost:-3, target?:<spec>, effects:[…] } ] }
 *
 * Once-per-turn / sorcery-speed timing is the caller's responsibility (documented), like sorcery timing.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesLoyalty = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function getLoyalty(card) { return (card && card.counters && card.counters.loyalty) || 0; }

  function bindEffects(effects, card, target) {
    return (effects || []).map(function (e) {
      var o = {}; for (var k in e) o[k] = e[k];
      if (o.seat === "controller") o.seat = card.controllerSeat;
      else if (o.seat === "owner") o.seat = card.ownerSeat;
      else if (o.seat === "target" && target && target.kind === "player") o.seat = target.seat;
      if (o.instanceId === "target" && target && target.kind === "card") o.instanceId = target.instanceId;
      return o;
    });
  }

  // set a planeswalker's starting loyalty (call right after it enters)
  function enterLoyalty(E, estate, instanceId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), card = estate.game.cards[instanceId];
    if (!card) return estate;
    var def = Cards ? Cards.get(card.name) : null;
    if (def && def.types.indexOf("planeswalker") >= 0 && def.loyalty) return E.dispatch(estate, { t: "card_counter", instanceId: instanceId, kind: "loyalty", delta: def.loyalty });
    return estate;
  }

  function activateLoyalty(E, estate, instanceId, abilityIndex, opts, ctx) {
    opts = opts || {};
    var Cards = pick(ctx, "Cards", "MTGCards"), Targeting = pick(ctx, "Targeting", "MTGRulesTargeting");
    var s = estate, card = s.game.cards[instanceId];
    if (!card) return { estate: s, ok: false, reason: "no such card" };
    var def = Cards ? Cards.get(card.name) : null;
    var ab = def && def.loyaltyAbilities && def.loyaltyAbilities[abilityIndex || 0];
    if (!ab) return { estate: s, ok: false, reason: "no such ability" };
    if (card.zone !== "battlefield") return { estate: s, ok: false, reason: "not on battlefield" };
    var cost = ab.cost || 0;
    if (getLoyalty(card) + cost < 0) return { estate: s, ok: false, reason: "not enough loyalty" };
    if (ab.target) {
      if (!opts.target) return { estate: s, ok: false, reason: "target required" };
      if (Targeting && !Targeting.isLegalTarget(s.game, ab.target, opts.target, { Cards: Cards, you: card.controllerSeat })) return { estate: s, ok: false, reason: "illegal target" };
    }
    s = E.dispatch(s, { t: "card_counter", instanceId: instanceId, kind: "loyalty", delta: cost });
    s = E.dispatch(s, { t: "stack_push", id: opts.id || ("loy-" + instanceId + "-" + (abilityIndex || 0)), controllerSeat: card.controllerSeat, kind: "ability", source: instanceId, effects: bindEffects(ab.effects, card, opts.target) });
    return { estate: s, ok: true, loyalty: getLoyalty(s.game.cards[instanceId]) };
  }

  // planeswalkers at 0 loyalty (a state-based action: they're put into the graveyard)
  function deadPlaneswalkers(game, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), out = [];
    for (var id in game.cards) {
      var c = game.cards[id]; if (c.zone !== "battlefield") continue;
      var def = Cards ? Cards.get(c.name) : null;
      if (def && def.types.indexOf("planeswalker") >= 0 && getLoyalty(c) <= 0) out.push(id);
    }
    return out;
  }

  return { enterLoyalty: enterLoyalty, getLoyalty: getLoyalty, activateLoyalty: activateLoyalty, deadPlaneswalkers: deadPlaneswalkers };
});

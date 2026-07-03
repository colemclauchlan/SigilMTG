/*
 * rules-activated.js — activated abilities (cost: effect). PURE (drives engine-core).
 * Browser global (window.MTGRulesActivated) + Node module. Validates and pays an activated ability's
 * cost (tap and/or mana, checked via rules-mana against the mana-pool counters), checks target
 * legality (rules-targeting), then puts the ability on the stack with its effects bound to the chosen
 * target. Resolution happens through engine-core's stack like any other object.
 *
 *   def.activated = [ { cost: { tap:true, mana:{...} }, target?: <targeting spec>,
 *                       effects: [ <table-core primitives; seat:"controller"|"owner"|"target",
 *                                   instanceId:"target" allowed> ] } ]
 *
 * Returns { estate, ok, reason }. Tap-for-mana ("produces") stays in card-defs; this is for the
 * general cost->effect case (pingers, pumps, sac outlets, etc.). Loyalty/restrictions deferred.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesActivated = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

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

  function setPool(E, estate, seat, pool) {
    var s = estate, cur = s.game.players[seat].counters || {};
    for (var k in cur) { if (k.indexOf("mana_") === 0 && cur[k]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: k, delta: -cur[k] }); }
    for (var c in (pool || {})) { if (pool[c]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: "mana_" + c, delta: pool[c] }); }
    return s;
  }

  function activate(E, estate, instanceId, abilityIndex, opts, ctx) {
    opts = opts || {};
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana"), Targeting = pick(ctx, "Targeting", "MTGRulesTargeting");
    var s = estate, card = s.game.cards[instanceId];
    if (!card) return { estate: s, ok: false, reason: "no such card" };
    var def = Cards ? Cards.get(card.name) : null;
    var ab = def && def.activated && def.activated[abilityIndex || 0];
    if (!ab) return { estate: s, ok: false, reason: "no such ability" };
    var seat = card.controllerSeat, cost = ab.cost || {};

    // ---- legality ----
    if (cost.tap && card.tapped) return { estate: s, ok: false, reason: "already tapped" };
    if (card.zone !== "battlefield") return { estate: s, ok: false, reason: "not on battlefield" };
    if (cost.mana) { var pool = Mana.poolFromCounters(s.game.players[seat].counters); if (!Mana.canPay(cost.mana, pool)) return { estate: s, ok: false, reason: "cannot pay mana" }; }
    if (ab.target) {
      if (!opts.target) return { estate: s, ok: false, reason: "target required" };
      if (Targeting && !Targeting.isLegalTarget(s.game, ab.target, opts.target, { Cards: Cards, you: seat })) return { estate: s, ok: false, reason: "illegal target" };
    }

    // ---- pay ----
    if (cost.tap) s = E.dispatch(s, { t: "card_tap", instanceId: instanceId, tapped: true });
    if (cost.mana) { var p2 = Mana.poolFromCounters(s.game.players[seat].counters); s = setPool(E, s, seat, Mana.pay(cost.mana, p2)); }

    // ---- put the ability on the stack ----
    s = E.dispatch(s, {
      t: "stack_push", id: opts.id || ("ab-" + instanceId + "-" + (abilityIndex || 0)),
      controllerSeat: seat, kind: "ability", source: instanceId,
      effects: bindEffects(ab.effects, card, opts.target)
    });
    return { estate: s, ok: true };
  }

  return { activate: activate, bindEffects: bindEffects };
});

/*
 * rules-spells.js — general targeted spell casting. PURE (drives engine-core).
 * Browser global (window.MTGRulesSpells) + Node module. Generalizes casting beyond simple burn:
 * validates mana (rules-mana) and target legality (rules-targeting), puts the spell on the stack with
 * its effects bound to the chosen target, and (for instants/sorceries) sends the spell to the graveyard
 * on resolution. Supports arbitrary table-core primitive effects, so bounce / destroy / pump / draw /
 * damage all work from data. Returns { estate, ok, reason }.
 *
 *   def.spell = { target?: <targeting spec>,
 *                 effects?: [ <primitives; seat:"controller"|"target", instanceId:"target" allowed> ],
 *                 damage?: N }   // shorthand: damage to the target (player -> life, creature -> marked)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSpells = mod;
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

  function isPermanentType(def) {
    var P = ["land", "creature", "artifact", "enchantment", "planeswalker", "battle"];
    return def.types.some(function (t) { return P.indexOf(t) >= 0; });
  }

  function castSpell(E, estate, instanceId, opts, ctx) {
    opts = opts || {};
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana"), Targeting = pick(ctx, "Targeting", "MTGRulesTargeting");
    var s = estate, card = s.game.cards[instanceId];
    if (!card) return { estate: s, ok: false, reason: "no such card" };
    var def = Cards ? Cards.get(card.name) : null, sp = def && def.spell;
    if (!sp) return { estate: s, ok: false, reason: "not a spell" };
    var seat = card.controllerSeat;

    if (def.mana) { var pool = Mana.poolFromCounters(s.game.players[seat].counters); if (!Mana.canPay(def.mana, pool)) return { estate: s, ok: false, reason: "cannot pay mana" }; }
    if (sp.target) {
      if (!opts.target) return { estate: s, ok: false, reason: "target required" };
      if (Targeting && !Targeting.isLegalTarget(s.game, sp.target, opts.target, { Cards: Cards, you: seat })) return { estate: s, ok: false, reason: "illegal target" };
    }
    if (def.mana) { var p2 = Mana.poolFromCounters(s.game.players[seat].counters); s = setPool(E, s, seat, Mana.pay(def.mana, p2)); }

    var effects;
    if (sp.effects) effects = bindEffects(sp.effects, card, opts.target);
    else if (sp.damage != null && opts.target) {
      effects = opts.target.kind === "player"
        ? [{ t: "adjust_life", seat: opts.target.seat, delta: -sp.damage }]
        : [{ t: "card_counter", instanceId: opts.target.instanceId, kind: "damage", delta: sp.damage }];
    } else effects = [];

    // a non-permanent spell goes to the graveyard after resolving
    if (def && !isPermanentType(def)) effects = effects.concat([{ t: "card_move", instanceId: instanceId, toZone: "graveyard" }]);

    s = E.dispatch(s, { t: "card_move", instanceId: instanceId, toZone: "stack" });
    s = E.dispatch(s, { t: "stack_push", id: opts.id || ("sp-" + instanceId), controllerSeat: seat, kind: "spell", source: instanceId, effects: effects });
    return { estate: s, ok: true };
  }

  return { castSpell: castSpell, bindEffects: bindEffects };
});

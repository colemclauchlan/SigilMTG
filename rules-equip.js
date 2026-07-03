/*
 * rules-equip.js — the EQUIP action (CR 301.5 / 702.6). PURE.
 * Browser global (window.MTGRulesEquip) + Node module. rules-attach computes an equipped creature's
 * buff; THIS makes equipping an actual game action: validate (it's your Equipment, target is a creature
 * YOU control, you can pay the equip cost), spend the mana, and set `attachedTo` via table-core's
 * `card_attach` event. Emitted as pure events (`equipEvents`) so it composes with engine-core.dispatch
 * OR plain table-core.reduce; `equip(E,estate,…)` is the convenience that dispatches them.
 *
 *   def (equipment) = { types:["artifact","equipment"], equips:{power,toughness,keywords}, equipCost:{generic:1} }
 *
 * Re-equipping moves the Equipment (card_attach overwrites attachedTo). Auras attach on cast (rules-spells),
 * not via an equip cost. Equip timing (sorcery-speed, your turn) is the caller's job, like other costs.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesEquip = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function canEquip(game, equipId, creatureId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var eq = game.cards[equipId];
    if (!eq || eq.zone !== "battlefield") return { ok: false, reason: "equipment not on the battlefield" };
    var def = Cards && Cards.get(eq.name);
    if (!def || def.types.indexOf("equipment") < 0) return { ok: false, reason: "not an Equipment" };
    var tgt = game.cards[creatureId];
    if (!tgt || tgt.zone !== "battlefield") return { ok: false, reason: "no such creature" };
    var tdef = Cards && Cards.get(tgt.name);
    if (!tdef || tdef.types.indexOf("creature") < 0) return { ok: false, reason: "target is not a creature" };
    if (tgt.controllerSeat !== eq.controllerSeat) return { ok: false, reason: "you can only equip a creature you control" };
    if (def.equipCost && Mana && !Mana.canPay(def.equipCost, Mana.poolFromCounters(game.players[eq.controllerSeat].counters)))
      return { ok: false, reason: "cannot pay the equip cost" };
    return { ok: true };
  }

  // pure events: spend the equip cost from the controller's mana pool, then attach
  function equipEvents(game, equipId, creatureId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var eq = game.cards[equipId], def = Cards && Cards.get(eq.name), seat = eq.controllerSeat, events = [];
    if (def && def.equipCost && Mana) {
      var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(def.equipCost, pool) || pool, colors = {};
      Object.keys(pool).forEach(function (c) { colors[c] = true; }); Object.keys(rem).forEach(function (c) { colors[c] = true; });
      Object.keys(colors).forEach(function (c) { var d = (rem[c] || 0) - (pool[c] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + c, delta: d }); });
    }
    events.push({ t: "card_attach", instanceId: equipId, attachedTo: creatureId });
    return events;
  }

  // convenience: validate + dispatch through engine-core (logs + replay-safe)
  function equip(E, estate, equipId, creatureId, ctx) {
    var chk = canEquip(estate.game, equipId, creatureId, ctx);
    if (!chk.ok) return { estate: estate, ok: false, reason: chk.reason };
    var s = estate;
    equipEvents(s.game, equipId, creatureId, ctx).forEach(function (ev) { s = E.dispatch(s, ev); });
    return { estate: s, ok: true };
  }

  return { canEquip: canEquip, equipEvents: equipEvents, equip: equip };
});

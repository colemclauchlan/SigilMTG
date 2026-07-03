/*
 * rules-aura.js — casting Auras (CR 303 / 702.5 "enchant"). PURE (drives engine-core for the cast).
 * Browser global (window.MTGRulesAura) + Node module. The Equipment pair: an Aura targets a creature
 * WHEN CAST (so hexproof/shroud and protection's "can't be enchanted by [color]" apply), and on
 * resolution it ENTERS the battlefield already attached — then rules-attach computes its buff.
 *   - canEnchant(game, auraId, targetId, ctx)   -> { ok, reason }  (targeting + hexproof + protection)
 *   - auraResolveEvents(auraId, targetId)        -> [card_move→battlefield, card_attach]  (PURE; replay-safe)
 *   - castAura(E, estate, auraId, targetId, ctx) -> { estate, ok, reason }  (mana + put on the stack)
 *
 *   def (aura) = { types:["enchantment","aura"], colors:["G"], enchants:{power,toughness,keywords} }
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAura = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function canEnchant(game, auraId, targetId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Hex = pick(ctx, "Hexproof", "MTGRulesHexproof"), Prot = pick(ctx, "Protection", "MTGRulesProtection");
    var aura = game.cards[auraId];
    if (!aura) return { ok: false, reason: "no such aura" };
    var def = Cards && Cards.get(aura.name);
    if (!def || def.types.indexOf("aura") < 0) return { ok: false, reason: "not an Aura" };
    var tgt = game.cards[targetId];
    if (!tgt || tgt.zone !== "battlefield") return { ok: false, reason: "no such creature" };
    var tdef = Cards && Cards.get(tgt.name);
    if (!tdef || tdef.types.indexOf("creature") < 0) return { ok: false, reason: "target is not a creature" };
    // hexproof/shroud (the aura's controller is the source)
    if (Hex && !Hex.canBeTargeted(game, targetId, aura.controllerSeat, ctx)) return { ok: false, reason: "target can't be enchanted (hexproof/shroud)" };
    // protection: "can't be enchanted by [color]" — the E in DEBT
    if (Prot && Prot.preventsDamageFrom && Prot.canBeTargetedBy) {
      var tEff = Prot.analyze(game, targetId, ctx);
      if (!Prot.canBeTargetedBy(tEff, def.colors || [])) return { ok: false, reason: "target has protection from this aura's color" };
    }
    return { ok: true };
  }

  // on resolution the aura enters the battlefield attached to its target
  function auraResolveEvents(auraId, targetId) {
    return [
      { t: "card_move", instanceId: auraId, toZone: "battlefield" },
      { t: "card_attach", instanceId: auraId, attachedTo: targetId }
    ];
  }

  function setPool(E, estate, seat, pool) {
    var s = estate, cur = s.game.players[seat].counters || {};
    for (var k in cur) { if (k.indexOf("mana_") === 0 && cur[k]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: k, delta: -cur[k] }); }
    for (var c in (pool || {})) { if (pool[c]) s = E.dispatch(s, { t: "player_counter", seat: seat, kind: "mana_" + c, delta: pool[c] }); }
    return s;
  }

  // cast the aura: validate target, pay mana, put it on the stack (it attaches on resolution)
  function castAura(E, estate, auraId, targetId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var chk = canEnchant(estate.game, auraId, targetId, ctx);
    if (!chk.ok) return { estate: estate, ok: false, reason: chk.reason };
    var s = estate, aura = s.game.cards[auraId], def = Cards && Cards.get(aura.name), seat = aura.controllerSeat;
    if (def && def.mana && Mana) {
      var pool = Mana.poolFromCounters(s.game.players[seat].counters);
      if (!Mana.canPay(def.mana, pool)) return { estate: s, ok: false, reason: "cannot pay mana" };
      s = setPool(E, s, seat, Mana.pay(def.mana, pool));
    }
    s = E.dispatch(s, { t: "card_move", instanceId: auraId, toZone: "stack" });
    s = E.dispatch(s, { t: "stack_push", id: (ctx && ctx.id) || ("aura-" + auraId), controllerSeat: seat, kind: "spell", source: auraId, effects: auraResolveEvents(auraId, targetId), targets: [{ kind: "card", instanceId: targetId }] });
    return { estate: s, ok: true };
  }

  return { canEnchant: canEnchant, auraResolveEvents: auraResolveEvents, castAura: castAura };
});

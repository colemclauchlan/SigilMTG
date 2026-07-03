/*
 * rules-attach.js — Equipment & Auras (CR 301 / 303 / 702.6). PURE.
 * Browser global (window.MTGRulesAttach) + Node module. Models a whole card category the engine didn't:
 * an Equipment/Aura attached to a creature contributes continuous effects (P/T in layer 7c, keyword
 * grants in layer 6) to that creature, folded through rules-layers exactly like anthems and lord grants —
 * so they stack correctly with statics and counters. Read-only over the board (an attachment is a card
 * on the battlefield whose `attachedTo` points at the creature).
 *
 *   def.equips   = { power?:N, toughness?:N, keywords?:[…] }   // Equipment
 *   def.enchants = { power?:N, toughness?:N, keywords?:[…] }   // Aura (same buff shape)
 *
 * Equip/attach as an ACTION (paying the equip cost, moving the attachment) is the renderer/table-core's
 * job; this is the rules contribution. Curses / attaching to players / protection-from removal deferred.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAttach = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  // attachments (equipment/auras) currently attached to a given creature
  function attachmentsOf(game, creatureId) {
    var out = [];
    for (var id in game.cards) { var c = game.cards[id]; if (c.zone === "battlefield" && c.attachedTo === creatureId) out.push(c); }
    return out;
  }

  // layer-system effects contributed to the equipped/enchanted creature by its attachments
  function attachmentEffects(game, creatureId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), out = [];
    attachmentsOf(game, creatureId).forEach(function (att, i) {
      var def = Cards ? Cards.get(att.name) : null, buff = def && (def.equips || def.enchants);
      if (!buff) return;
      if (buff.power || buff.toughness) out.push({ id: "atk-" + att.instanceId, layer: 7, sublayer: "d", timestamp: i, op: "pt_mod", power: buff.power || 0, toughness: buff.toughness || 0 });
      if (buff.keywords && buff.keywords.length) out.push({ id: "atkw-" + att.instanceId, layer: 6, timestamp: i, op: "ability_add", abilities: buff.keywords.slice() });
    });
    return out;
  }

  // full effective state of a creature: printed base + anthems (static) + keyword grants + ATTACHMENTS
  function effectiveAttached(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Layers = pick(ctx, "Layers", "MTGRulesLayers");
    var Static = pick(ctx, "Static", "MTGRulesStatic"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    var card = game.cards[cardId]; if (!card) return null;
    var def = Cards ? Cards.get(card.name) : null; if (!def) return null;
    var base = Cards.printedBase(def, { counters: card.counters, controller: card.controllerSeat });
    var effects = (Static ? Static.effectsForCard(game, cardId, ctx) : [])
      .concat(KW ? KW.keywordEffectsForCard(game, cardId, ctx) : [])
      .concat(attachmentEffects(game, cardId, ctx));
    return Layers.computeEffectiveState(base, effects);
  }

  return { attachmentsOf: attachmentsOf, attachmentEffects: attachmentEffects, effectiveAttached: effectiveAttached };
});

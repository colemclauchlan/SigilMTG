/*
 * rules-prowess.js — prowess (CR 702.108). PURE.
 * Browser global (window.MTGRulesProwess) + Node module. "Whenever you cast a noncreature spell, this
 * creature gets +1/+1 until end of turn." Prowess is a triggered ability that fires once PER noncreature
 * spell cast by the creature's controller, each putting a separate +1/+1-until-EOT effect on the creature.
 * This module computes the EFFECTIVE P/T of a prowess creature given how many noncreature spells its
 * controller has cast this turn (the running count the caller tracks), stacking the bonus on top of the
 * creature's already-effective base (counters, anthems, granted keywords) via rules-keywords/rules-layers.
 *
 *   hasProwess(abilities)                                   -> does this ability list include prowess
 *   prowessBonus(game, id, noncreatureSpellCount, ctx)     -> { power, toughness } effective = base + N/+N
 *
 * Honors GRANTED prowess (a lord/aura/equipment that grants "prowess" makes the creature trigger too).
 * Magecraft (instant/sorcery cast OR copied) is the close cousin and is deferred & documented.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesProwess = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  // effective ability list of a card, honoring granted keywords (equipment/aura then static grants)
  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }

  // effective base P/T of a card (counters + anthems + grants), independent of prowess
  function effectiveBase(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), Layers = pick(ctx, "Layers", "MTGRulesLayers");
    var c = game.cards[id]; if (!c) return { power: null, toughness: null };
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e) return { power: e.power, toughness: e.toughness }; }
    var def = Cards && Cards.get(c.name);
    if (def && Layers) {
      var base = Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat });
      var st = Layers.computeEffectiveState(base, []);
      return { power: st.power, toughness: st.toughness };
    }
    return { power: def ? def.power : null, toughness: def ? def.toughness : null };
  }

  function hasProwess(abilities) { return (abilities || []).indexOf("prowess") >= 0; }

  // effective {power,toughness} for a prowess creature after N noncreature spells were cast this turn
  function prowessBonus(game, id, noncreatureSpellCount, ctx) {
    var b = effectiveBase(game, id, ctx);
    var n = noncreatureSpellCount | 0; if (n < 0) n = 0;
    var ab = abilitiesOf(game, id, ctx);
    var bump = hasProwess(ab) ? n : 0; // no prowess -> no bonus, regardless of spells cast
    return {
      power: b.power == null ? null : b.power + bump,
      toughness: b.toughness == null ? null : b.toughness + bump
    };
  }

  return { abilitiesOf: abilitiesOf, effectiveBase: effectiveBase, hasProwess: hasProwess, prowessBonus: prowessBonus };
});

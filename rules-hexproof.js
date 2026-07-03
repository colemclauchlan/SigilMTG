/*
 * rules-hexproof.js — hexproof (CR 702.11) & shroud (CR 702.18) targeting restrictions. PURE.
 * Browser global (window.MTGRulesHexproof) + Node module. Completes the "can't be targeted" family that
 * rules-targeting defers (alongside rules-protection): operates on EFFECTIVE abilities (rules-keywords,
 * so GRANTED hexproof/shroud counts) and layers the restriction on top of rules-targeting:
 *   - shroud   -> can't be targeted by ANY spell/ability (its controller included)
 *   - hexproof -> can't be targeted by spells/abilities an OPPONENT controls
 *   - filterTargets()/isLegalTarget() wrap rules-targeting with the restriction (ctx.you = source's seat)
 * (Player hexproof — e.g. Leyline of Sanctity — and "hexproof from [quality]" are deferred & documented.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesHexproof = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  // effective abilities for a battlefield permanent (granted keywords via rules-keywords)
  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    // prefer the attachment-aware effective state so EQUIPMENT/AURA-granted hexproof/shroud counts
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }
    if (KW && KW.effectiveFull) return KW.effectiveFull(game, id, ctx).abilities || [];
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }
  function has(list, kw) { return list.indexOf(kw) >= 0; }

  // can a source controlled by `sourceSeat` legally target the permanent `id`?
  function canBeTargeted(game, id, sourceSeat, ctx) {
    var c = game.cards[id]; if (!c) return false;
    var ab = abilitiesOf(game, id, ctx);
    if (has(ab, "shroud")) return false;                                  // no one may target it
    if (has(ab, "hexproof") && sourceSeat != null && c.controllerSeat !== sourceSeat) return false; // opponents may not
    return true;
  }

  // rules-targeting.isLegalTarget + the hexproof/shroud restriction (players unaffected here)
  function isLegalTarget(game, spec, target, ctx) {
    var Targeting = pick(ctx, "Targeting", "MTGRulesTargeting");
    if (Targeting && !Targeting.isLegalTarget(game, spec, target, ctx)) return false;
    if (target && target.kind === "card") return canBeTargeted(game, target.instanceId, ctx && ctx.you, ctx);
    return true;
  }

  // rules-targeting.legalTargets with hexproof/shroud-protected permanents removed
  function filterTargets(game, spec, ctx) {
    var Targeting = pick(ctx, "Targeting", "MTGRulesTargeting");
    var base = Targeting ? Targeting.legalTargets(game, spec, ctx) : [];
    return base.filter(function (t) { return t.kind !== "card" || canBeTargeted(game, t.instanceId, ctx && ctx.you, ctx); });
  }

  return { canBeTargeted: canBeTargeted, isLegalTarget: isLegalTarget, filterTargets: filterTargets, abilitiesOf: abilitiesOf };
});

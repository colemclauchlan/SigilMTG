/*
 * rules-mutate.js — mutate (CR 702.140, Ikoria). PURE.
 * Browser global (window.MTGRulesMutate) + Node module. A creature spell with mutate may merge with a
 * target non-Human creature you own, going on top of or under it. The result is ONE permanent whose
 * copiable characteristics are the TOP card's, but it has ALL abilities from every card in the merge pile.
 * Modeled by tracking the merge pile of card NAMES (top first) on the base permanent.
 *
 *   def.mutate = { generic:2, G:1 }    // the (cheaper) mutate cost
 *
 *   canMutate(game, baseId, mutatorId, ctx)        -> { ok, reason }   (target is a non-Human creature you control)
 *   mutateEvents(game, baseId, mutatorId, over, ctx) -> [set the merge pile, fold the mutator in]
 *   mergePile(game, id) / mergedProfile(game, id, ctx) -> name/P/T of the top + the UNION of abilities
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMutate = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function mergePile(game, id) { var c = game.cards[id]; return (c && c.merge) || (c ? [c.name] : []); }

  function canMutate(game, baseId, mutatorId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var base = game.cards[baseId], mut = game.cards[mutatorId];
    if (!base || base.zone !== "battlefield") return { ok: false, reason: "no target creature" };
    var bdef = Cards && Cards.get(base.name);
    if (!bdef || bdef.types.indexOf("creature") < 0) return { ok: false, reason: "target is not a creature" };
    if ((bdef.subtypes || []).indexOf("human") >= 0) return { ok: false, reason: "can't mutate onto a Human" };
    if (mut && Cards) { var mdef = Cards.get(mut.name); if (!mdef || !mdef.mutate) return { ok: false, reason: "no mutate" }; }
    return { ok: true };
  }

  function mutateEvents(game, baseId, mutatorId, over, ctx) {
    var mut = game.cards[mutatorId], pile = mergePile(game, baseId);
    var next = over ? [mut.name].concat(pile) : pile.concat([mut.name]);
    return [
      { t: "__set", cards: [{ id: baseId, fields: { merge: next } }] },
      { t: "__set", cards: [{ id: mutatorId, fields: { mergedInto: baseId, zone: "merged" } }] }   // folded into the permanent
    ];
  }

  // the merged permanent: the TOP card's name/P/T + the union of all merged cards' abilities
  function mergedProfile(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), pile = mergePile(game, id);
    var topDef = Cards && Cards.get(pile[0]); if (!topDef) return null;
    var abilities = [];
    pile.forEach(function (name) { var d = Cards && Cards.get(name); (d && d.abilities || []).forEach(function (a) { if (abilities.indexOf(a) < 0) abilities.push(a); }); });
    return { name: pile[0], power: topDef.power, toughness: topDef.toughness, abilities: abilities, pile: pile.slice() };
  }

  return { mergePile: mergePile, canMutate: canMutate, mutateEvents: mutateEvents, mergedProfile: mergedProfile };
});

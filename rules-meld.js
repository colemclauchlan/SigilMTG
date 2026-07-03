/*
 * rules-meld.js — meld (CR 712.2). PURE.
 * Browser global (window.MTGRulesMeld) + Node module. Certain SPECIFIC pairs of cards meld: they're
 * exiled and returned combined as a single oversized permanent (the meld result). Modeled with a pairing
 * DSL: each card names the partner it `meldsWith` and the `meldResult` name; melding sets the result on one
 * card and folds the partner into it (like mutate).
 *
 *   def.meldsWith = "Partner Name" ;  def.meldResult = "Result Name"   // the Result is its own card def
 *
 *   canMeld(game, idA, idB, ctx)     -> { ok, reason, result? }
 *   meldEvents(game, idA, idB, ctx)   -> [become the meld result, fold the partner in]
 *   meldedProfile(game, id, ctx)      -> the meld result's characteristics (for a melded permanent)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMeld = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function canMeld(game, idA, idB, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), a = game.cards[idA], b = game.cards[idB];
    if (!a || !b || a.zone !== "battlefield" || b.zone !== "battlefield") return { ok: false, reason: "both halves must be on the battlefield" };
    if (a.controllerSeat !== b.controllerSeat) return { ok: false, reason: "you must control both" };
    var dA = Cards && Cards.get(a.name), dB = Cards && Cards.get(b.name);
    if (!dA || !dB || dA.meldsWith !== b.name || dB.meldsWith !== a.name) return { ok: false, reason: "not a meld pair" };
    return { ok: true, result: dA.meldResult };
  }

  function meldEvents(game, idA, idB, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), dA = Cards && Cards.get(game.cards[idA].name);
    return [
      { t: "__set", cards: [{ id: idA, fields: { melded: dA.meldResult } }] },
      { t: "__set", cards: [{ id: idB, fields: { mergedInto: idA, zone: "merged" } }] }
    ];
  }

  function meldedProfile(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id]; if (!c || !c.melded) return null;
    var def = Cards && Cards.get(c.melded); if (!def) return null;
    return { name: c.melded, power: def.power, toughness: def.toughness, types: (def.types || []).slice(), abilities: (def.abilities || []).slice() };
  }

  return { canMeld: canMeld, meldEvents: meldEvents, meldedProfile: meldedProfile };
});

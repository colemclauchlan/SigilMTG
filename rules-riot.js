/*
 * rules-riot.js — riot (CR 702.132). PURE.
 * Browser global (window.MTGRulesRiot) + Node module. "This creature enters the battlefield with your
 * choice of a +1/+1 counter or haste." The counter is a real card_counter event; the haste choice is a
 * `riotHaste` marker field the driver's sickness check honors (hasHaste). autoChoice picks haste when
 * the creature could attack right away (controller's turn, no printed haste), else the counter — and
 * always the counter when the creature already has haste, where the counter is strictly better.
 *
 *   hasRiot(game, id, ctx)               -> does this creature have riot (printed or granted)
 *   enterEvents(game, id, choice, ctx)   -> [card_counter] | [__set riotHaste]   choice: "counter"|"haste"
 *   hasHaste(game, id, ctx)              -> printed haste OR the riot haste marker
 *   autoChoice(game, id, ctx)            -> "counter" | "haste"  (deterministic policy)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesRiot = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  // effective ability list, honoring granted keywords when rules-keywords is around
  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    var c = game.cards[id]; if (!c) return [];
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }

  function hasRiot(game, id, ctx) { return abilitiesOf(game, id, ctx).indexOf("riot") >= 0; }

  function enterEvents(game, id, choice, ctx) {
    if (!game.cards[id] || !hasRiot(game, id, ctx)) return [];
    if (choice === "counter") return [{ t: "card_counter", instanceId: id, kind: "+1/+1", delta: 1 }];
    return [{ t: "__set", cards: [{ id: id, fields: { riotHaste: true } }] }];
  }

  function hasHaste(game, id, ctx) {
    var c = game.cards[id]; if (!c) return false;
    return !!c.riotHaste || abilitiesOf(game, id, ctx).indexOf("haste") >= 0;
  }

  // policy: printed haste makes the counter strictly better; otherwise take haste when the creature
  // could swing this turn (its controller is the active player), else bank the counter.
  function autoChoice(game, id, ctx) {
    var c = game.cards[id]; if (!c) return "counter";
    if (abilitiesOf(game, id, ctx).indexOf("haste") >= 0) return "counter";
    return game.activeSeat === c.controllerSeat ? "haste" : "counter";
  }

  return { hasRiot: hasRiot, enterEvents: enterEvents, hasHaste: hasHaste, autoChoice: autoChoice };
});

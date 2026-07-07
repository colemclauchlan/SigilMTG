/*
 * rules-myriad.js — myriad (CR 702.116). PURE.
 * Browser global (window.MTGRulesMyriad) + Node module. "Whenever this creature attacks, for each
 * opponent other than the defending player, you may create a token that's a copy of it that's tapped
 * and attacking that player. Exile the tokens at the end of combat."
 *
 * onAttack returns replayable events: one token copy per OTHER opponent, created tapped + attacking
 * (token_create carries no tap/attack flags in the reducer, so each copy is followed by its card_tap
 * and card_combat events). The copy's characteristics are baked into a registered card-def (same
 * registry rules-tokens.ensureDef uses). endOfCombat exiles the copies — the board's token SBA
 * (CR 704.5d: a token outside the battlefield ceases to exist) finishes the cleanup.
 *
 *   def.myriad = true  (e.g. Cards.define("Caged Sun Bearer", { ..., myriad: true }))
 *
 *   hasMyriad(def)                        -> bool
 *   onAttack(game, id, defendingSeat, ctx) -> { events:[...], tokenIds:[...] }  ({events:[],tokenIds:[]} when n/a)
 *   endOfCombat(tokenIds)                 -> [card_move -> exile × N]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesMyriad = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function hasMyriad(def) { return !!(def && def.myriad); }

  // seats of every opponent of `seat` other than `defendingSeat`
  function otherOpponents(game, seat, defendingSeat) {
    var out = [];
    var n = game.seats != null ? game.seats : (game.players ? game.players.length : 0);
    for (var s = 0; s < n; s++) { if (s !== seat && s !== defendingSeat) out.push(s); }
    return out;
  }

  function copySpec(Cards, c) {
    var base = (Cards && Cards.get(c.name)) || {};
    return {
      tokenName: (c.name || "Attacker") + " (Myriad)",
      power: base.power != null ? base.power : 1,
      toughness: base.toughness != null ? base.toughness : 1,
      subtypes: (base.subtypes || []).slice(),
      colors: (base.colors || []).slice(),
      abilities: (base.abilities || []).slice()
    };
  }

  // The creature attacked `defendingSeat`: create a tapped attacking copy for each other opponent.
  function onAttack(game, id, defendingSeat, ctx) {
    var none = { events: [], tokenIds: [] };
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game && game.cards ? game.cards[id] : null;
    if (!c || c.zone !== "battlefield") return none;
    var def = Cards && Cards.get(c.name);
    if (!hasMyriad(def)) return none;
    var seat = c.controllerSeat != null ? c.controllerSeat : c.ownerSeat;
    var targets = otherOpponents(game, seat, defendingSeat);
    if (!targets.length) return none;
    var spec = copySpec(Cards, c);
    if (Cards && !Cards.get(spec.tokenName)) {
      Cards.define(spec.tokenName, {
        types: ["creature"], subtypes: spec.subtypes, colors: spec.colors, abilities: spec.abilities,
        power: spec.power, toughness: spec.toughness, isToken: true
      });
    }
    var salt = (game.log && game.log.length) || 0, events = [], ids = [];
    for (var i = 0; i < targets.length; i++) {
      var tid = "tok-" + spec.tokenName.replace(/[^A-Za-z0-9]+/g, "") + "-" + seat + "-" + salt + "-" + i;
      ids.push(tid);
      events.push({ t: "token_create", instanceId: tid, name: spec.tokenName, ownerSeat: seat, zone: "battlefield", x: 40 + 6 * i, y: 52, myriadDefends: targets[i] });
      events.push({ t: "card_tap", instanceId: tid, tapped: true });          // created tapped…
      events.push({ t: "card_combat", instanceId: tid, attacking: true });   // …and attacking that player
    }
    return { events: events, tokenIds: ids };
  }

  // End of combat: exile the myriad copies (the token SBA then removes them entirely).
  function endOfCombat(tokenIds) {
    return (tokenIds || []).map(function (id) { return { t: "card_move", instanceId: id, toZone: "exile" }; });
  }

  return { hasMyriad: hasMyriad, otherOpponents: otherOpponents, copySpec: copySpec, onAttack: onAttack, endOfCombat: endOfCombat };
});

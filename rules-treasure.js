/*
 * rules-treasure.js — Treasure / Food / Clue artifact tokens. PURE.
 * Browser global (window.MTGRulesTreasure) + Node module. The ubiquitous modern/Commander artifact tokens:
 *   - Treasure: "{T}, Sacrifice this: Add one mana of any color."
 *   - Food:     "{2}, {T}, Sacrifice this: You gain 3 life."
 *   - Clue:     "{2}, Sacrifice this: Draw a card."
 * Token CREATION is a replay-safe __add; the SAC ability is returned as events. (The {2}/{T} activation
 * costs are the caller's to pay, like other costs; this models the sacrifice + its effect.)
 *
 *   register(Cards?)                  -> define the three token card types
 *   create(seat, kind, id)            -> __add event for one token   kind = "Treasure"|"Food"|"Clue"
 *   sacrifice(game, id, opts)         -> [card_move → graveyard, + the token's effect]   opts.color for Treasure
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesTreasure = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function register(Cards) {
    Cards = Cards || root.MTGCards; if (!Cards) return;
    Cards.define("Treasure", { types: ["artifact"], subtypes: ["treasure"], colors: [] });
    Cards.define("Food", { types: ["artifact"], subtypes: ["food"], colors: [] });
    Cards.define("Clue", { types: ["artifact"], subtypes: ["clue"], colors: [] });
    return Cards;
  }

  function create(seat, kind, id) {
    return { t: "__add", cards: [{ instanceId: id, name: kind, ownerSeat: seat, controllerSeat: seat, zone: "battlefield", isToken: true, counters: {} }] };
  }

  function sacrifice(game, id, opts) {
    opts = opts || {}; var c = game.cards[id]; if (!c) return [];
    var seat = c.controllerSeat, events = [{ t: "card_move", instanceId: id, toZone: "graveyard" }];
    if (c.name === "Treasure") events.push({ t: "player_counter", seat: seat, kind: "mana_" + (opts.color || "C"), delta: 1 });
    else if (c.name === "Food") events.push({ t: "adjust_life", seat: seat, delta: 3 });
    else if (c.name === "Clue") events.push({ t: "draw", seat: seat, count: 1 });
    return events;
  }

  return { register: register, create: create, sacrifice: sacrifice };
});

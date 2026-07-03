/*
 * rules-amass.js — amass (CR 701.46 / 701.47). PURE.
 * Browser global (window.MTGRulesAmass) + Node module. "Amass N — If you don't control an Army, create a
 * 0/0 black Army creature token. Then put N +1/+1 counters on an Army you control." Newer templating is
 * "Amass <Type> N", which also makes that Army the given creature type (e.g. Zombie or Orc). We reuse the
 * existing token-id convention (tok-<Name>-<seat>-<loglen>-<i>) and the +1/+1 counter event so the rest of
 * the engine (layers/SBA) treats the Army exactly like any token creature.
 *
 * If the player already controls an Army, no token is created — the counters go on the EXISTING Army
 * (deterministically the lowest-id Army when several exist). The Army keeps growing across multiple amass.
 *
 *   armiesControlled(game, seat, ctx)        -> [ids] of Army creatures the seat controls
 *   amass(game, seat, n, armyType, ctx)      -> { events:[ token_create? , card_counter ], armyId, created:bool }
 *       armyType defaults to "Zombie"; pass e.g. "Orc" for Amass Orc. `events` are replay-safe; armyId is
 *       the (existing or freshly-derived) Army instance id the counters land on.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAmass = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function subtypesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    var c = game.cards[id]; if (!c) return [];
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e && e.subtypes) return e.subtypes; }
    var def = Cards && Cards.get(c.name); return def ? (def.subtypes || []) : [];
  }
  function isArmy(game, id, ctx) { return subtypesOf(game, id, ctx).indexOf("Army") >= 0; }

  // Armies the seat controls, lowest id first (deterministic target choice).
  function armiesControlled(game, seat, ctx) {
    var ids = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.zone === "battlefield" && c.controllerSeat === seat && isArmy(game, id, ctx)) ids.push(id);
    }
    ids.sort(function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); });
    return ids;
  }

  // The token id we WOULD mint for a new Army, matching rules-tokens.js's convention.
  function armyTokenId(game, seat, name) {
    var logLen = game.log ? game.log.length : 0;
    return "tok-" + (name || "Army").replace(/[^A-Za-z0-9]+/g, "") + "-" + seat + "-" + logLen + "-0";
  }

  // Amass N: ensure an Army exists (create a 0/0 black Army <type> token if none), then add N +1/+1 counters.
  function amass(game, seat, n, armyType, ctx) {
    var count = n | 0;
    var type = armyType || "Zombie";
    var existing = armiesControlled(game, seat, ctx);
    var events = [], armyId, created = false;

    if (existing.length) {
      armyId = existing[0];
    } else {
      created = true;
      var tokenName = type + " Army";
      armyId = armyTokenId(game, seat, tokenName);
      // Register the def so layers/SBA know it's a 0/0 black creature with subtypes [type, "Army"].
      var Cards = pick(ctx, "Cards", "MTGCards");
      if (Cards && !Cards.get(tokenName)) {
        Cards.define(tokenName, { types: ["creature"], subtypes: [type, "Army"], colors: ["B"], power: 0, toughness: 0, isToken: true });
      }
      events.push({
        t: "token_create", instanceId: armyId, name: tokenName, ownerSeat: seat,
        zone: "battlefield", x: 50, y: 60
      });
    }

    if (count > 0) events.push({ t: "card_counter", instanceId: armyId, kind: "+1/+1", delta: count });
    return { events: events, armyId: armyId, created: created };
  }

  return {
    pick: pick, isArmy: isArmy, armiesControlled: armiesControlled,
    armyTokenId: armyTokenId, amass: amass
  };
});

/*
 * rules-blocking.js — a simple blocking AI for the defending player. PURE.
 * Browser global (window.MTGRulesBlocking) + Node module. Given an attack plan, assigns the
 * defender's untapped creatures as blockers using a heuristic on EFFECTIVE P/T (rules-keywords /
 * rules-layers): prefer a block that both kills the attacker and survives, then one that kills
 * (a trade), then one that survives; otherwise let it through. Deathtouch counts as "kills",
 * and an attacker's deathtouch removes "survives". Read-only; returns a filled-in attack plan.
 *
 *   chooseBlocks(game, defenderSeat, attackPlan, ctx) -> [ { attacker, blockers:[id] } ]
 *
 * Heuristic only (no multi-block, no chump-to-save-life, no evasion handling) — enough to make
 * auto-games involve real combat decisions; richer AI is deferred.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesBlocking = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function kw(c, k) { return (c.abilities || []).indexOf(k) >= 0; }

  function effective(game, id, ctx) {
    var KW = pick(ctx, "Keywords", "MTGRulesKeywords");
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); if (e) { e.id = id; return e; } }
    var Cards = pick(ctx, "Cards", "MTGCards"), Layers = pick(ctx, "Layers", "MTGRulesLayers"), c = game.cards[id];
    if (!c) return null; var def = Cards ? Cards.get(c.name) : null; if (!def || def.power == null) return null;
    var x = Layers.computeEffectiveState(Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat }), []); x.id = id; return x;
  }

  function chooseBlocks(game, defenderSeat, attackPlan, ctx) {
    var Core = pick(ctx, "Core", "MTGCore"), used = {};
    var blockers = Core.cardsOf(game, defenderSeat, "battlefield")
      .filter(function (c) { return !c.tapped; })
      .map(function (c) { return effective(game, c.instanceId, ctx); })
      .filter(Boolean);

    return (attackPlan || []).map(function (pair) {
      var atk = effective(game, pair.attacker, ctx);
      if (!atk) return { attacker: pair.attacker, blockers: [] };
      var best = null, score = -1;
      blockers.forEach(function (b) {
        if (used[b.id]) return;
        var kills = (b.power >= atk.toughness) || kw(b, "deathtouch");
        var survives = (atk.power < b.toughness) && !kw(atk, "deathtouch");
        var sc = (kills ? 2 : 0) + (survives ? 1 : 0);
        if (sc > score) { score = sc; best = b; }
      });
      if (best && score >= 1) { used[best.id] = true; return { attacker: pair.attacker, blockers: [best.id] }; }
      return { attacker: pair.attacker, blockers: [] };
    });
  }

  return { chooseBlocks: chooseBlocks, effective: effective };
});

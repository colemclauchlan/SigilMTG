/*
 * rules-sba.js — Phase R1 state-based-action DETECTORS (read-only / advisory).
 * Browser global (window.MTGRulesSBA) + Node module. PURE: each detector reads the table-core
 * game state and returns findings; NOTHING is mutated. These are the universal CR-704 / Commander
 * checks that don't depend on any card-definition choices (so they're safe to build before the
 * §10 decisions). They are not yet wired into the renderer — a later, reviewed step turns these
 * findings into UI hints (R1-UI) or, once the engine is authoritative, into automatic actions (R3+).
 *
 * Finding shape: { rule, kind, severity, seat?, instanceId?, instanceIds?, message }
 * Detectors only read what table-core actually models (players: life/counters/cmdDamage;
 * cards: name/zone/controllerSeat/isToken/attachedTo/counters), so every check is real, not aspirational.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  if (root) root.MTGRulesSBA = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // CR 704.5a — a player at 0 or less life loses.
  function lifeLoss(game) {
    var out = [];
    (game.players || []).forEach(function (p) {
      if (p && p.life <= 0) out.push({ rule: "704.5a", kind: "player_loss", severity: "loss", seat: p.seat, message: "Seat " + p.seat + " is at " + p.life + " life and would lose" });
    });
    return out;
  }

  // CR 704.5c — a player with 10+ poison counters loses.
  function poison(game) {
    var out = [];
    (game.players || []).forEach(function (p) {
      var n = p && p.counters ? (p.counters.poison || 0) : 0;
      if (n >= 10) out.push({ rule: "704.5c", kind: "player_loss", severity: "loss", seat: p.seat, message: "Seat " + p.seat + " has " + n + " poison and would lose" });
    });
    return out;
  }

  // CR 903.10a (Commander) — 21+ combat damage from a single commander.
  function commanderDamage(game) {
    var out = [];
    (game.players || []).forEach(function (p) {
      var cd = p && p.cmdDamage ? p.cmdDamage : {};
      for (var src in cd) {
        if (cd[src] >= 21) out.push({ rule: "903.10a", kind: "player_loss", severity: "loss", seat: p.seat, message: "Seat " + p.seat + " has " + cd[src] + " commander damage from " + src + " and would lose" });
      }
    });
    return out;
  }

  // CR 704.5f — a token not on the battlefield ceases to exist.
  function strayToken(game) {
    var out = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.isToken && c.zone !== "battlefield") out.push({ rule: "704.5f", kind: "cease_to_exist", severity: "cleanup", instanceId: id, message: 'Token "' + (c.name || id) + '" is in ' + c.zone + " and would cease to exist" });
    }
    return out;
  }

  // CR 704.5 (auras/equipment) — an attachment whose host is missing or no longer a battlefield permanent.
  function orphanAttachment(game) {
    var out = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.attachedTo == null || c.zone !== "battlefield") continue;
      var host = game.cards[c.attachedTo];
      if (!host || host.zone !== "battlefield") out.push({ rule: "704.5", kind: "attachment", severity: "cleanup", instanceId: id, message: '"' + (c.name || id) + '" is attached to a missing or off-battlefield permanent' });
    }
    return out;
  }

  // CR 704.5j (advisory) — multiple same-named nontoken permanents under one controller.
  // table-core doesn't model the "legendary" supertype, so this is surfaced as a candidate, not enforced.
  function legendRuleCandidate(game) {
    var groups = {}, out = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (c.zone !== "battlefield" || c.isToken || !c.name) continue;
      var key = c.controllerSeat + "|" + c.name;
      (groups[key] = groups[key] || []).push(c);
    }
    for (var k in groups) {
      var g = groups[k];
      if (g.length >= 2) out.push({ rule: "704.5j", kind: "legend_rule", severity: "candidate", seat: g[0].controllerSeat, instanceIds: g.map(function (c) { return c.instanceId; }), message: "Seat " + g[0].controllerSeat + " controls " + g.length + '× "' + g[0].name + '" — legend rule may apply' });
    }
    return out;
  }

  var DETECTORS = [lifeLoss, poison, commanderDamage, strayToken, orphanAttachment, legendRuleCandidate];

  function detectAll(game) {
    var out = [];
    if (!game) return out;
    DETECTORS.forEach(function (fn) { out = out.concat(fn(game) || []); });
    return out;
  }

  return {
    detectAll: detectAll,
    detectors: { lifeLoss: lifeLoss, poison: poison, commanderDamage: commanderDamage, strayToken: strayToken, orphanAttachment: orphanAttachment, legendRuleCandidate: legendRuleCandidate },
    DETECTORS: DETECTORS
  };
});

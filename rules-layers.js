/*
 * rules-layers.js — Phase R2 continuous-effects LAYER SYSTEM (CR 613). PURE.
 * Browser global (window.MTGRulesLayers) + Node module. computeEffectiveState(base, effects)
 * folds a list of continuous effects onto a card's printed characteristics in the fixed CR-613
 * layer order, producing the card's *effective* characteristics. Nothing is mutated.
 *
 * "Compute, don't mutate" is the core engine decision: a card's live P/T, types, colors, and
 * abilities are DERIVED here on demand — the printed/base object is never changed.
 *
 * v1 layers: 1 copy · 2 control · 4 type · 5 color · 6 ability add/remove · 7 P/T (7a CDA,
 * 7b set, 7c counters, 7d +N/+N). Within a layer, effects apply in TIMESTAMP order; layers
 * always beat timestamps (e.g. a "becomes 0/1" set still happens before a "+2/+2" even if the
 * set has a later timestamp). Deferred to a later pass (documented): layer 3 text-changing and
 * the full dependency system (CR 613.8). Effects are declarative data (serializable → replay-safe).
 *
 * base   = { name, controller, types:[], subtypes:[], colors:[], abilities:[], power, toughness, counters:{} }
 * effect = { id, layer, sublayer?, timestamp, op, ...args }
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesLayers = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function union(a, b) { var out = (a || []).slice(); (b || []).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); return out; }
  function byTs(a, b) { return (a.timestamp || 0) - (b.timestamp || 0) || String(a.id == null ? "" : a.id).localeCompare(String(b.id == null ? "" : b.id)); }

  function computeEffectiveState(base, effects) {
    var c = clone(base || {});
    c.types = c.types || []; c.subtypes = c.subtypes || []; c.colors = c.colors || [];
    c.abilities = c.abilities || []; c.counters = c.counters || {};
    var all = (effects || []).slice();
    function inLayer(L, sub) {
      return all.filter(function (e) { return e.layer === L && (sub == null ? true : e.sublayer === sub); }).sort(byTs);
    }

    // Layer 1 — copy effects (copy printed characteristics; counters & controller are not copied)
    inLayer(1).forEach(function (e) {
      if (e.op === "copy" && e.base) {
        var keepCounters = c.counters, keepController = c.controller, b = clone(e.base);
        c.name = b.name; c.types = b.types || []; c.subtypes = b.subtypes || []; c.colors = b.colors || [];
        c.abilities = b.abilities || []; c.power = b.power; c.toughness = b.toughness;
        c.counters = keepCounters; c.controller = keepController;
      }
    });
    // Layer 2 — control-changing
    inLayer(2).forEach(function (e) { if (e.op === "control_set") c.controller = e.controller; });
    // Layer 4 — type-changing
    inLayer(4).forEach(function (e) {
      if (e.op === "type_set") { if (e.types) c.types = e.types.slice(); if (e.subtypes) c.subtypes = e.subtypes.slice(); }
      else if (e.op === "type_add") { c.types = union(c.types, e.types); c.subtypes = union(c.subtypes, e.subtypes); }
    });
    // Layer 5 — color-changing
    inLayer(5).forEach(function (e) {
      if (e.op === "color_set") c.colors = (e.colors || []).slice();
      else if (e.op === "color_add") c.colors = union(c.colors, e.colors);
      else if (e.op === "colorless") c.colors = [];
    });
    // Layer 6 — ability add/remove
    inLayer(6).forEach(function (e) {
      if (e.op === "ability_add") c.abilities = union(c.abilities, e.abilities);
      else if (e.op === "ability_remove") c.abilities = c.abilities.filter(function (k) { return (e.abilities || []).indexOf(k) < 0; });
      else if (e.op === "ability_remove_all") c.abilities = [];
    });
    // Layer 7 — power/toughness, in sublayer order 7a -> 7b -> 7c (counters) -> 7d
    inLayer(7, "a").forEach(function (e) { if (e.op === "pt_set") { c.power = e.power; c.toughness = e.toughness; } });
    inLayer(7, "b").forEach(function (e) { if (e.op === "pt_set") { c.power = e.power; c.toughness = e.toughness; } });
    if (c.power != null) {
      var d = (c.counters["+1/+1"] || 0) - (c.counters["-1/-1"] || 0);
      c.power += d; c.toughness += d;
    }
    inLayer(7, "d").forEach(function (e) {
      if (e.op === "pt_mod") { if (c.power != null) c.power += (e.power || 0); if (c.toughness != null) c.toughness += (e.toughness || 0); }
    });
    return c;
  }

  return { computeEffectiveState: computeEffectiveState };
});

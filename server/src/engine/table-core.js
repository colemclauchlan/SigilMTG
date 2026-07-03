/*
 * table-core.js — PURE reducer for the MTG virtual tabletop (Model C spine).
 * Browser global (window.MTGCore) and Node module. reduce() is pure & never throws;
 * invert(a,s) yields an action such that reduce(reduce(s,a),inv) deep-equals s.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  if (root) root.MTGCore = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ZONES = ["library", "hand", "battlefield", "graveyard", "exile", "command", "stack"];
  var PILE_ZONES = ["library", "hand", "graveyard", "exile", "command", "stack"];

  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, seed) {
    var rng = mulberry32(hashSeed(seed == null ? "seed" : seed));
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function newCard(over) {
    return {
      instanceId: over.instanceId,
      cardId: over.cardId != null ? over.cardId : null,
      name: over.name != null ? over.name : "",
      ownerSeat: over.ownerSeat != null ? over.ownerSeat : 0,
      controllerSeat: over.controllerSeat != null ? over.controllerSeat : (over.ownerSeat != null ? over.ownerSeat : 0),
      zone: over.zone != null ? over.zone : "library",
      pos: over.pos != null ? over.pos : 0,
      x: over.x != null ? over.x : null,
      y: over.y != null ? over.y : null,
      z: over.z != null ? over.z : 0,
      tapped: !!over.tapped,
      faceDown: !!over.faceDown,
      flipped: over.flipped != null ? over.flipped : 0,
      phased: !!over.phased,
      attacking: !!over.attacking,
      counters: over.counters ? clone(over.counters) : {},
      attachedTo: over.attachedTo != null ? over.attachedTo : null,
      attachOrder: over.attachOrder != null ? over.attachOrder : null,
      isToken: !!over.isToken,
      isCommander: !!over.isCommander,
      setCode: over.setCode != null ? over.setCode : null,
      collectorNumber: over.collectorNumber != null ? over.collectorNumber : null,
      isFoil: !!over.isFoil,
      isEtched: !!over.isEtched,
      revealedTo: over.revealedTo ? over.revealedTo.slice() : []
    };
  }

  function init(opts) {
    opts = opts || {};
    var seats = opts.seats != null ? opts.seats : 1;
    var deckSize = opts.deckSize != null ? opts.deckSize : 99;
    var startingLife = opts.startingLife != null ? opts.startingLife : 40;
    var state = { seats: seats, activeSeat: 0, turn: 1, phase: "main1", players: [], annotations: {}, cards: {} };
    for (var s = 0; s < seats; s++) {
      state.players.push({ seat: s, life: startingLife, counters: {}, cmdDamage: {} });
      var deck = opts.decks && opts.decks[s];
      if (deck && deck.length) {
        for (var d = 0; d < deck.length; d++) {
          var src = deck[d];
          var id = src.instanceId || ("s" + s + "c" + d);
          var zone = src.isCommander ? "command" : (src.zone || "library");
          state.cards[id] = newCard({ instanceId: id, cardId: src.cardId != null ? src.cardId : id, name: src.name || "", ownerSeat: s, controllerSeat: s, zone: zone, pos: d, isCommander: !!src.isCommander });
        }
      } else {
        for (var i = 0; i < deckSize; i++) {
          var gid = "s" + s + "c" + i;
          state.cards[gid] = newCard({ instanceId: gid, cardId: gid, name: "Card " + i, ownerSeat: s, controllerSeat: s, zone: "library", pos: i });
        }
      }
    }
    return state;
  }

  function cardsOf(state, seat, zone) {
    var out = [];
    for (var id in state.cards) { var c = state.cards[id]; if (c.ownerSeat === seat && c.zone === zone) out.push(c); }
    out.sort(function (a, b) { return (a.pos || 0) - (b.pos || 0); });
    return out;
  }
  function nextPos(state, seat, zone) {
    var max = -1;
    for (var id in state.cards) { var c = state.cards[id]; if (c.ownerSeat === seat && c.zone === zone && c.pos > max) max = c.pos; }
    return max + 1;
  }
  function zoneCount(state, seat, zone) { return cardsOf(state, seat, zone).length; }
  function firstId(state, zone, seat) {
    for (var id in state.cards) { var c = state.cards[id]; if (c.zone === zone && (seat == null || c.ownerSeat === seat)) return id; }
    return null;
  }

  var TRACK = ["zone", "pos", "x", "y", "z", "tapped", "faceDown", "flipped", "phased", "attacking", "counters", "attachedTo", "attachOrder", "controllerSeat", "setCode", "collectorNumber", "isFoil", "isEtched", "revealedTo", "name", "cardId"];
  function snap(card, fields) {
    fields = fields || TRACK;
    var o = {};
    for (var i = 0; i < fields.length; i++) { var f = fields[i]; o[f] = card[f] && typeof card[f] === "object" ? clone(card[f]) : card[f]; }
    return o;
  }

  function reduce(state, action) {
    if (!action || !action.t) return state;
    var s = clone(state);
    var a = action;
    switch (a.t) {
      case "__set": {
        if (a.cards) a.cards.forEach(function (e) { var c = s.cards[e.id]; if (!c) return; for (var k in e.fields) c[k] = e.fields[k] && typeof e.fields[k] === "object" ? clone(e.fields[k]) : e.fields[k]; });
        if (a.players) a.players.forEach(function (e) { if (s.players[e.seat]) for (var k in e.fields) s.players[e.seat][k] = e.fields[k] && typeof e.fields[k] === "object" ? clone(e.fields[k]) : e.fields[k]; });
        if (a.annotations) a.annotations.forEach(function (e) { s.annotations[e.id] = clone(e.value); });
        if (a.turn != null) s.turn = a.turn;
        if (a.activeSeat != null) s.activeSeat = a.activeSeat;
        if (a.phase != null) s.phase = a.phase;
        return s;
      }
      case "__remove": { (a.ids || []).forEach(function (id) { delete s.cards[id]; }); return s; }
      case "__removeAnno": { (a.ids || []).forEach(function (id) { delete s.annotations[id]; }); return s; }
      case "__add": { (a.cards || []).forEach(function (c) { s.cards[c.instanceId] = clone(c); }); return s; }
      case "draw": {
        var lib = cardsOf(s, a.seat, "library");
        var n = Math.min(a.count != null ? a.count : 1, lib.length);
        var base = nextPos(s, a.seat, "hand");
        for (var i = 0; i < n; i++) { lib[i].zone = "hand"; lib[i].pos = base + i; }
        return s;
      }
      case "mill": {
        var lib2 = cardsOf(s, a.seat, "library");
        var m = Math.min(a.count != null ? a.count : 1, lib2.length);
        var gbase = nextPos(s, a.seat, "graveyard");
        for (var j = 0; j < m; j++) { lib2[j].zone = "graveyard"; lib2[j].pos = gbase + j; }
        return s;
      }
      case "card_move": {
        var c = s.cards[a.instanceId]; if (!c) return s;
        c.zone = a.toZone;
        if (a.toZone === "battlefield") { if (a.x != null) c.x = a.x; if (a.y != null) c.y = a.y; if (a.z != null) c.z = a.z; }
        else { c.x = null; c.y = null; c.pos = a.pos != null ? a.pos : nextPos(s, c.ownerSeat, a.toZone); }
        return s;
      }
      case "card_tap": { var ct = s.cards[a.instanceId]; if (!ct) return s; ct.tapped = a.tapped != null ? a.tapped : !ct.tapped; return s; }
      case "card_tap_many": { (a.instanceIds || []).forEach(function (id) { var c = s.cards[id]; if (c) c.tapped = !!a.tapped; }); return s; }
      case "untap_all": { for (var id in s.cards) { var c = s.cards[id]; if (c.controllerSeat === a.seat && c.zone === "battlefield" && !c.phased) c.tapped = false; } return s; }
      case "card_counter": {
        var cc = s.cards[a.instanceId]; if (!cc) return s;
        var cur = cc.counters[a.kind] || 0; var nv = cur + (a.delta || 0);
        if (nv === 0) delete cc.counters[a.kind]; else cc.counters[a.kind] = nv;
        return s;
      }
      case "player_counter": {
        var pp = s.players[a.seat]; if (!pp) return s; pp.counters = pp.counters || {};
        var pcur = pp.counters[a.kind] || 0; var pnv = pcur + (a.delta || 0);
        if (pnv === 0) delete pp.counters[a.kind]; else pp.counters[a.kind] = pnv;
        return s;
      }
      case "commander_damage": {
        var dp = s.players[a.seat]; if (!dp) return s; dp.cmdDamage = dp.cmdDamage || {};
        var key = a.fromSeat + ":" + (a.fromCmd || "primary");
        var dnv = (dp.cmdDamage[key] || 0) + (a.delta || 0);
        if (dnv === 0) delete dp.cmdDamage[key]; else dp.cmdDamage[key] = dnv;
        return s;
      }
      case "card_flip": { var cf = s.cards[a.instanceId]; if (!cf) return s; cf.faceDown = a.faceDown != null ? a.faceDown : !cf.faceDown; return s; }
      case "card_transform": { var ctr = s.cards[a.instanceId]; if (!ctr) return s; ctr.flipped = a.flipped != null ? a.flipped : (ctr.flipped ? 0 : 1); return s; }
      case "card_phase": { var cp = s.cards[a.instanceId]; if (!cp) return s; cp.phased = a.phased != null ? a.phased : !cp.phased; return s; }
      case "card_combat": { var cmb = s.cards[a.instanceId]; if (!cmb) return s; cmb.attacking = a.attacking != null ? a.attacking : !cmb.attacking; return s; }
      case "card_attach": { var ca = s.cards[a.instanceId]; if (!ca) return s; ca.attachedTo = a.attachedTo != null ? a.attachedTo : null; ca.attachOrder = a.attachOrder != null ? a.attachOrder : ca.attachOrder; return s; }
      case "token_create": {
        s.cards[a.instanceId] = newCard({ instanceId: a.instanceId, cardId: a.cardId != null ? a.cardId : null, name: a.name || "Token", ownerSeat: a.ownerSeat, controllerSeat: a.ownerSeat, zone: a.zone || "battlefield", x: a.x != null ? a.x : 50, y: a.y != null ? a.y : 50, isToken: true });
        return s;
      }
      case "card_clone": {
        var srcC = s.cards[a.fromId]; if (!srcC) return s;
        var copy = clone(srcC); copy.instanceId = a.instanceId; copy.isToken = true;
        copy.x = a.x != null ? a.x : srcC.x; copy.y = a.y != null ? a.y : srcC.y;
        s.cards[a.instanceId] = copy; return s;
      }
      case "library_shuffle": {
        var libs = cardsOf(s, a.seat, "library");
        shuffle(libs.map(function (c) { return c.instanceId; }), a.seed).forEach(function (id, idx) { s.cards[id].pos = idx; });
        return s;
      }
      case "library_scry": { (a.order || []).forEach(function (id, idx) { if (s.cards[id]) s.cards[id].pos = idx; }); return s; }
      case "reveal": {
        (a.instanceIds || []).forEach(function (id) { var c = s.cards[id]; if (!c) return; (a.toSeats || []).forEach(function (seat) { if (c.revealedTo.indexOf(seat) < 0) c.revealedTo.push(seat); }); });
        return s;
      }
      case "card_setart": {
        var cs = s.cards[a.instanceId]; if (!cs) return s;
        if (a.cardId != null) cs.cardId = a.cardId;
        if (a.name != null) cs.name = a.name;
        if (a.setCode != null) cs.setCode = a.setCode;
        if (a.collectorNumber != null) cs.collectorNumber = a.collectorNumber;
        if (a.isFoil != null) cs.isFoil = a.isFoil;
        if (a.isEtched != null) cs.isEtched = a.isEtched;
        if (a.flipped != null) cs.flipped = a.flipped;
        return s;
      }
      case "set_life": { if (s.players[a.seat]) s.players[a.seat].life = a.value; return s; }
      case "set_phase": { s.phase = a.phase; return s; }
      case "adjust_life": { if (s.players[a.seat]) s.players[a.seat].life += (a.delta || 0); return s; }
      case "pass_turn": { s.activeSeat = a.toSeat != null ? a.toSeat : (s.activeSeat + 1) % s.seats; s.turn = (s.turn || 1) + 1; return s; }
      case "annotation_create": { s.annotations[a.id] = { kind: a.kind || "label", x: a.x || 0, y: a.y || 0, text: a.text || "", value: a.value != null ? a.value : 0, seat: a.seat != null ? a.seat : null }; return s; }
      case "annotation_move": { var an = s.annotations[a.id]; if (!an) return s; if (a.x != null) an.x = a.x; if (a.y != null) an.y = a.y; return s; }
      case "annotation_update": { var au = s.annotations[a.id]; if (!au) return s; if (a.text != null) au.text = a.text; if (a.value != null) au.value = a.value; return s; }
      case "annotation_delete": { delete s.annotations[a.id]; return s; }
      default: return state;
    }
  }

  function invert(action, before) {
    var a = action;
    switch (a.t) {
      case "draw": { var lib = cardsOf(before, a.seat, "library"); var n = Math.min(a.count != null ? a.count : 1, lib.length); return { t: "__set", cards: lib.slice(0, n).map(function (c) { return { id: c.instanceId, fields: { zone: "library", pos: c.pos, x: c.x, y: c.y } }; }) }; }
      case "mill": { var lib2 = cardsOf(before, a.seat, "library"); var m = Math.min(a.count != null ? a.count : 1, lib2.length); return { t: "__set", cards: lib2.slice(0, m).map(function (c) { return { id: c.instanceId, fields: { zone: "library", pos: c.pos } }; }) }; }
      case "card_move": { var c = before.cards[a.instanceId]; if (!c) return { t: "__noop" }; return { t: "__set", cards: [{ id: a.instanceId, fields: snap(c, ["zone", "pos", "x", "y", "z"]) }] }; }
      case "card_tap": { var c1 = before.cards[a.instanceId]; return c1 ? { t: "__set", cards: [{ id: a.instanceId, fields: { tapped: c1.tapped } }] } : { t: "__noop" }; }
      case "card_tap_many": { return { t: "__set", cards: (a.instanceIds || []).filter(function (id) { return before.cards[id]; }).map(function (id) { return { id: id, fields: { tapped: before.cards[id].tapped } }; }) }; }
      case "untap_all": { var aff = []; for (var id in before.cards) { var c2 = before.cards[id]; if (c2.controllerSeat === a.seat && c2.zone === "battlefield" && !c2.phased) aff.push({ id: id, fields: { tapped: c2.tapped } }); } return { t: "__set", cards: aff }; }
      case "card_counter": return { t: "card_counter", instanceId: a.instanceId, kind: a.kind, delta: -(a.delta || 0) };
      case "player_counter": return { t: "player_counter", seat: a.seat, kind: a.kind, delta: -(a.delta || 0) };
      case "commander_damage": return { t: "commander_damage", seat: a.seat, fromSeat: a.fromSeat, fromCmd: a.fromCmd, delta: -(a.delta || 0) };
      case "card_flip": { var cf = before.cards[a.instanceId]; return cf ? { t: "__set", cards: [{ id: a.instanceId, fields: { faceDown: cf.faceDown } }] } : { t: "__noop" }; }
      case "card_transform": { var ctr = before.cards[a.instanceId]; return ctr ? { t: "__set", cards: [{ id: a.instanceId, fields: { flipped: ctr.flipped } }] } : { t: "__noop" }; }
      case "card_phase": { var cp = before.cards[a.instanceId]; return cp ? { t: "__set", cards: [{ id: a.instanceId, fields: { phased: cp.phased } }] } : { t: "__noop" }; }
      case "card_combat": { var cmb = before.cards[a.instanceId]; return cmb ? { t: "__set", cards: [{ id: a.instanceId, fields: { attacking: cmb.attacking } }] } : { t: "__noop" }; }
      case "card_attach": { var ca = before.cards[a.instanceId]; return ca ? { t: "__set", cards: [{ id: a.instanceId, fields: { attachedTo: ca.attachedTo, attachOrder: ca.attachOrder } }] } : { t: "__noop" }; }
      case "token_create": return { t: "__remove", ids: [a.instanceId] };
      case "card_clone": return { t: "__remove", ids: [a.instanceId] };
      case "library_shuffle": { var libs = cardsOf(before, a.seat, "library"); return { t: "__set", cards: libs.map(function (c) { return { id: c.instanceId, fields: { pos: c.pos } }; }) }; }
      case "library_scry": { return { t: "__set", cards: (a.order || []).filter(function (id) { return before.cards[id]; }).map(function (id) { return { id: id, fields: { pos: before.cards[id].pos } }; }) }; }
      case "reveal": { return { t: "__set", cards: (a.instanceIds || []).filter(function (id) { return before.cards[id]; }).map(function (id) { return { id: id, fields: { revealedTo: before.cards[id].revealedTo.slice() } }; }) }; }
      case "card_setart": { var cs = before.cards[a.instanceId]; if (!cs) return { t: "__noop" }; return { t: "__set", cards: [{ id: a.instanceId, fields: snap(cs, ["cardId", "name", "setCode", "collectorNumber", "isFoil", "isEtched", "flipped"]) }] }; }
      case "set_life": { var p = before.players[a.seat]; return p ? { t: "__set", players: [{ seat: a.seat, fields: { life: p.life } }] } : { t: "__noop" }; }
      case "set_phase": return { t: "set_phase", phase: before.phase };
      case "adjust_life": return { t: "adjust_life", seat: a.seat, delta: -(a.delta || 0) };
      case "pass_turn": return { t: "__set", turn: before.turn, activeSeat: before.activeSeat };
      case "annotation_create": return { t: "__removeAnno", ids: [a.id] };
      case "annotation_move": { var an = before.annotations[a.id]; return an ? { t: "annotation_move", id: a.id, x: an.x, y: an.y } : { t: "__noop" }; }
      case "annotation_update": { var au = before.annotations[a.id]; return au ? { t: "annotation_update", id: a.id, text: au.text, value: au.value } : { t: "__noop" }; }
      case "annotation_delete": { var ad = before.annotations[a.id]; return ad ? { t: "annotation_create", id: a.id, kind: ad.kind, x: ad.x, y: ad.y, text: ad.text, value: ad.value, seat: ad.seat } : { t: "__noop" }; }
      default: return { t: "__noop" };
    }
  }

  return { ZONES: ZONES, PILE_ZONES: PILE_ZONES, init: init, reduce: reduce, invert: invert, shuffle: shuffle, zoneCount: zoneCount, firstId: firstId, cardsOf: cardsOf, nextPos: nextPos };
});

/*
 * rules-dungeon.js — Dungeons & venture (CR 309 / 700.12). PURE.
 * Browser global (window.MTGRulesDungeon) + Node module. A dungeon is a directed graph of rooms, each with
 * an effect and links to the next room(s). "Venture into the dungeon" = enter the first room (if you're not
 * in a dungeon) or advance to a connected room; when you complete a dungeon (reach a room with no next) you
 * may venture into a new one. The player's position lives on `players[seat].dungeon` (table-core __set), so
 * it's replay-safe; dungeon DEFINITIONS are fixed config (like card-defs).
 *
 *   defineDungeon(name, { start, rooms:{ id:{ effects:[…], next:[id…] } } })
 *   venture(game, seat, dungeonName, toRoomId, ctx) -> { events, effects, room, completed }
 *   position(game, seat) / roomEffects(name, roomId) / completed(game, seat)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesDungeon = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var DUNGEONS = {};
  function defineDungeon(name, spec) { DUNGEONS[name] = spec; return spec; }
  function getDungeon(name) { return DUNGEONS[name] || null; }
  function position(game, seat) { var p = game.players[seat]; return (p && p.dungeon) || null; }
  function roomEffects(name, roomId) { var d = DUNGEONS[name]; return (d && d.rooms[roomId] && d.rooms[roomId].effects) || []; }

  function completed(game, seat) {
    var pos = position(game, seat); if (!pos) return false;
    var d = DUNGEONS[pos.name], room = d && d.rooms[pos.room];
    return !!room && (!room.next || room.next.length === 0);
  }

  function setPos(seat, name, room) { return [{ t: "__set", players: [{ seat: seat, fields: { dungeon: { name: name, room: room } } }] }]; }

  // venture: enter a dungeon's first room, or advance to a connected room
  function venture(game, seat, dungeonName, toRoomId, ctx) {
    var pos = position(game, seat);
    // not currently in a dungeon (or finished one) -> enter the named dungeon at its start
    if (!pos || completed(game, seat)) {
      var d = DUNGEONS[dungeonName]; if (!d) return { events: [], effects: [], room: null, completed: false, reason: "no such dungeon" };
      return { events: setPos(seat, dungeonName, d.start), effects: roomEffects(dungeonName, d.start), room: d.start, completed: false };
    }
    // advance within the current dungeon to a connected room
    var cur = DUNGEONS[pos.name], room = cur && cur.rooms[pos.room];
    if (!room || (room.next || []).indexOf(toRoomId) < 0) return { events: [], effects: [], room: pos.room, completed: completed(game, seat), reason: "not a connected room" };
    return { events: setPos(seat, pos.name, toRoomId), effects: roomEffects(pos.name, toRoomId), room: toRoomId, completed: (cur.rooms[toRoomId].next || []).length === 0 };
  }

  return { defineDungeon: defineDungeon, getDungeon: getDungeon, position: position, roomEffects: roomEffects, completed: completed, venture: venture };
});

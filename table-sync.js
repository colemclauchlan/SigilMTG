/*
 * table-sync.js — PROMPT 3 multiplayer engine for the virtual tabletop.
 * Model: the SERVER (game_card_instances, RLS-filtered) is the source of truth. Each client rebuilds its
 * local table-core-shaped state from the rows it is allowed to read (its own hidden zones + everyone's public
 * zones). Opponents' hand/library never arrive (RLS) — we synthesize face-down placeholders from zone_counts.
 * Hidden info is therefore enforced by Postgres, not the client. Depends on window.mtgSync + window.MTGCore.
 */
window.MTGTableSync = (function () {
  "use strict";
  var sync = window.mtgSync;
  var S = { online: false, gameId: null, mySeat: null, myPart: null, partToSeat: {}, seatToPart: {}, lastRows: {}, debounce: null };
  var api = { onRemote: null, onError: null, onConn: null };

  function uuid() { return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2); }
  function isUuid(v) { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(v); }
  function ready() { return sync && sync.enabled && sync.session; }

  // A card's true identity must NOT live on the SHARED game_card_instances row while the
  // card sits in a hidden zone: the UPDATE policy is game-wide, so a member could move the
  // row into a public zone and read it. Identity for hidden cards lives only in the
  // owner-gated game_card_hidden table. Hidden = hand/library, or face-down on battlefield.
  function isHidden(ci) {
    return ci.zone === "hand" || ci.zone === "library" || (ci.faceDown && ci.zone === "battlefield");
  }
  function hiddenRow(ci) {
    return {
      instance_id: ci.instanceId, game_id: S.gameId,
      owner_participant_id: S.seatToPart[ci.ownerSeat],
      scryfall_id: isUuid(ci.cardId) ? ci.cardId : null,
      card_name: ci.name || "",
      characteristics: ci.characteristics || {}
    };
  }

  // ---- mapping: table-core CardInstance <-> game_card_instances row ----
  function toRow(ci) {
    var hide = isHidden(ci);
    // Combat state (attacking/blocking) rides the dedicated "combat" column (20260706_game_card_instances_combat_state
    // migration) so every seated player's client renders the same attack/defend icon on a creature.
    var combat = ci.attacking ? "attacking" : (ci.blocking ? "blocking" : null);
    return {
      id: ci.instanceId, game_id: S.gameId,
      owner_participant_id: S.seatToPart[ci.ownerSeat],
      controller_participant_id: S.seatToPart[ci.controllerSeat != null ? ci.controllerSeat : ci.ownerSeat],
      scryfall_id: hide ? null : (isUuid(ci.cardId) ? ci.cardId : null),
      card_name: hide ? "" : (ci.name || ""),
      zone: ci.zone, pos: ci.pos, x: ci.x, y: ci.y, z: ci.z || 0,
      tapped: !!ci.tapped, face_down: !!ci.faceDown, flipped_face: ci.flipped || 0,
      counters: ci.counters || {}, attached_to: ci.attachedTo || null, attach_order: ci.attachOrder,
      is_token: !!ci.isToken, is_commander: !!ci.isCommander, phased: !!ci.phased,
      is_foil: !!ci.isFoil, is_etched: !!ci.isEtched, set_code: ci.setCode || null, collector_number: ci.collectorNumber || null,
      revealed_to: ci.revealedTo || [], combat: combat
    };
  }
  function fromRow(r) {
    return {
      instanceId: r.id, cardId: r.scryfall_id || r.card_name || r.id, name: r.card_name || "",
      ownerSeat: S.partToSeat[r.owner_participant_id], controllerSeat: S.partToSeat[r.controller_participant_id != null ? r.controller_participant_id : r.owner_participant_id],
      zone: r.zone, pos: Number(r.pos) || 0, x: r.x, y: r.y, z: r.z || 0,
      tapped: !!r.tapped, faceDown: !!r.face_down, flipped: r.flipped_face || 0, phased: !!r.phased,
      attacking: r.combat === "attacking", blocking: r.combat === "blocking",
      counters: r.counters || {}, attachedTo: r.attached_to || null, attachOrder: r.attach_order,
      isToken: !!r.is_token, isCommander: !!r.is_commander, isFoil: !!r.is_foil, isEtched: !!r.is_etched,
      setCode: r.set_code || null, collectorNumber: r.collector_number || null, revealedTo: r.revealed_to || []
    };
  }

  // deck list ({cardId,name,isCommander}) -> my-seat card objects (library shuffled, commander in command)
  function buildDeckCards(deckList, seed, handSize) {
    var cards = [], idx = 0;
    var ids = deckList.map(function () { return uuid(); });
    var order = MTGCore.shuffle(ids.map(function (_, i) { return i; }), seed || ("seed-" + S.gameId));
    var posOf = {}; order.forEach(function (origIdx, p) { posOf[origIdx] = p; });
    deckList.forEach(function (e, i) {
      var commander = !!e.isCommander;
      cards.push({
        instanceId: ids[i], cardId: e.cardId, name: e.name, ownerSeat: S.mySeat, controllerSeat: S.mySeat,
        zone: commander ? "command" : "library", pos: commander ? idx++ : posOf[i],
        tapped: false, faceDown: false, flipped: 0, counters: {}, isCommander: commander, isToken: false
      });
    });
    // Deal the opening hand into the persisted rows too — otherwise the first pull() rebuilds the
    // board from DB rows with an empty hand and the local "drew 7" evaporates.
    var hand = Math.max(0, Math.min(Number(handSize) || 0, cards.length));
    if (hand) {
      var libs = cards.filter(function (c) { return c.zone === "library"; }).sort(function (a, b) { return a.pos - b.pos; });
      libs.slice(0, hand).forEach(function (c, i) { c.zone = "hand"; c.pos = i; });
    }
    return cards;
  }
  // persist my deck: blank-identity instance rows for the shared board + true identity to the owner-only hidden table
  async function persistMyCards(cards) {
    var res = await sync.upsertCardInstances(cards.map(toRow));
    if (res && res.error) throw res.error; // surface RLS/constraint failures — swallowing them wiped decks
    var hid = cards.filter(isHidden).map(hiddenRow);
    if (hid.length && sync.upsertHidden) {
      var hres = await sync.upsertHidden(hid);
      if (hres && hres.error) throw hres.error;
    }
  }

  function setMaps(participants) {
    S.partToSeat = {}; S.seatToPart = {};
    participants.forEach(function (p) { S.partToSeat[p.id] = p.seat_index; S.seatToPart[p.seat_index] = p.id; });
  }

  // ---- build a table-core-shaped state from DB rows (+ counts for hidden placeholders) ----
  function buildLocalState(data, counts, hidden) {
    var participants = data.participants || [];
    setMaps(participants);
    var seats = participants.length || 1;
    var state = { seats: seats, activeSeat: (data.game && data.game.active_seat_index) || 0, turn: (data.game && data.game.total_turns) || 1, phase: (data.game && data.game.phase) || "main1", settings: (data.game && data.game.settings) || {}, players: [], annotations: {}, cards: {} };
    for (var i = 0; i < seats; i++) {
      var p = participants[i] || { life: 40 };
      state.players[i] = { seat: i, life: p.life_total != null ? p.life_total : 40, counters: {}, cmdDamage: {}, name: p.display_name || ("Seat " + i) };
    }
    // apply synced player counters (poison/energy/etc.) and commander damage
    (data.counters || []).forEach(function (c) {
      var seat = S.partToSeat[c.participant_id];
      if (seat == null || !state.players[seat] || !c.value) return;
      state.players[seat].counters[c.counter_key] = Number(c.value) || 0;
    });
    (data.cmdDamage || []).forEach(function (d) {
      var tSeat = S.partToSeat[d.target_participant_id], sSeat = S.partToSeat[d.source_participant_id];
      if (tSeat == null || sSeat == null || !state.players[tSeat] || !d.value) return;
      state.players[tSeat].cmdDamage[sSeat + ":" + (d.source_commander_id || "primary")] = d.value;
    });
    var hidById = {}; (hidden || []).forEach(function (h) { hidById[h.instance_id] = h; });
    (data.instances || []).forEach(function (r) {
      var ci = fromRow(r);
      if (ci.ownerSeat == null) return;
      // restore MY OWN hidden-zone identity from the owner-gated hidden table (the shared row is blank for hidden zones)
      if (ci.ownerSeat === S.mySeat && !ci.name && hidById[ci.instanceId]) {
        var h = hidById[ci.instanceId];
        ci.name = h.card_name || ""; ci.cardId = h.scryfall_id || h.card_name || ci.instanceId;
      }
      state.cards[ci.instanceId] = ci;
    });
    // synthesize opponent hidden-zone placeholders from counts (so I see "opponent has 7 in hand")
    (counts || []).forEach(function (c) {
      var seat = S.partToSeat[c.owner_participant_id];
      if (seat === S.mySeat || seat == null) return;
      if (c.zone !== "hand" && c.zone !== "library") return;
      var have = 0; for (var id in state.cards) { var k = state.cards[id]; if (k.ownerSeat === seat && k.zone === c.zone) have++; }
      for (var n = have; n < c.n; n++) {
        var pid = "ph-" + c.owner_participant_id + "-" + c.zone + "-" + n;
        state.cards[pid] = { instanceId: pid, cardId: null, name: "", ownerSeat: seat, controllerSeat: seat, zone: c.zone, pos: n, x: null, y: null, z: 0, tapped: false, faceDown: true, flipped: 0, phased: false, counters: {}, attachedTo: null, isToken: false, isCommander: false, revealedTo: [], _placeholder: true };
      }
    });
    return state;
  }

  async function pull() {
    if (!S.online) return;
    try {
      var _pull = await Promise.all([sync.loadGameState(S.gameId), sync.zoneCounts(S.gameId), sync.loadHidden ? sync.loadHidden(S.gameId) : Promise.resolve([])]);
      var data = _pull[0], counts = _pull[1], hidden = _pull[2];
      var state = buildLocalState(data, counts, hidden);
      cacheMine(state);
      if (api.onRemote) api.onRemote(state);
    } catch (e) { if (api.onError) api.onError(e); }
  }
  function cacheMine(state) {
    S.lastRows = {};
    for (var id in state.cards) { var c = state.cards[id]; if (c.ownerSeat === S.mySeat && !c._placeholder) S.lastRows[id] = true; }
  }
  function schedulePull() { clearTimeout(S.debounce); S.debounce = setTimeout(pull, 120); }

  function subscribe() {
    sync.subscribeToGame(S.gameId, function (evt) {
      if (evt.kind === "db") { if (!S.lobbyOnly) schedulePull(); }
      else if (evt.kind === "ephemeral" && api.onEphemeral) api.onEphemeral(evt.payload);
    }, function (status) {
      // Connection lifecycle → drive a reconnect/resume indicator in the table UI.
      if (status === "SUBSCRIBED") {
        if (S.wasDropped) { S.wasDropped = false; pull(); if (api.onConn) api.onConn("reconnected"); }
        else if (api.onConn) api.onConn("connected");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        S.wasDropped = true; if (api.onConn) api.onConn("reconnecting");
      }
    });
  }

  // ---- public: host / join ----
  async function host(deckList, opts) {
    if (!ready()) throw new Error("Sign in to host an online game.");
    opts = opts || {};
    var row = { owner_id: sync.uid(), name: opts.name || "Commander table", visibility: opts.visibility || "private", starting_life: opts.startingLife || 40 };
    if (opts.scheduledAt) row.scheduled_at = opts.scheduledAt; // playgroup.gg-style scheduled game (column via 20260702000000 migration)
    var ins = await sync.client.from("games").insert(row).select().single();
    if (ins.error) throw ins.error;
    S.gameId = ins.data.id; S.online = true; S.mySeat = 0;
    var pr = await sync.client.from("game_participants").insert({ game_id: S.gameId, profile_id: sync.uid(), seat_index: 0, display_name: opts.displayName || "Host", life_total: opts.startingLife || 40 }).select().single();
    if (pr.error) throw pr.error;
    S.myPart = pr.data.id; setMaps([pr.data]);
    if (deckList && deckList.length) await persistMyCards(buildDeckCards(deckList, null, opts.hand != null ? opts.hand : 7));
    subscribe(); await pull();
    return S.gameId;
  }
  async function join(gameId, deckList, opts) {
    if (!ready()) throw new Error("Sign in to join an online game.");
    opts = opts || {};
    S.gameId = gameId; S.online = true; S.lobbyOnly = false;
    // Primary path: the join_game RPC (SECURITY DEFINER) assigns the seat atomically. A client-side
    // seat computation can't work for PRIVATE games — RLS hides the existing participants from a
    // not-yet-member, so SELECT returns [] and INSERT..RETURNING can't see its own new row either.
    var parts = null, rpcErr = null;
    try {
      var rj = await sync.client.rpc("join_game", { p_game: gameId, p_display_name: opts.displayName || "Player", p_life: opts.startingLife || 40 });
      if (rj.error) throw rj.error;
      var jd = rj.data || {};
      // G7.57 — join_game_spectator_gate migration: the game already started, so no seat was made.
      // Reset the online flags we speculatively set above (never really joined) and surface a
      // typed error the caller can branch on to route into the read-only spectate view instead.
      if (jd.spectate) {
        S.online = false; S.gameId = null;
        var specErr = new Error("This game has already started — you can watch as a spectator.");
        specErr.spectate = true; specErr.visibility = jd.visibility || "private";
        throw specErr;
      }
      S.mySeat = jd.seat_index; S.myPart = jd.participant_id;
      parts = jd.participants || [];
    } catch (e) { if (e && e.spectate) throw e; rpcErr = e; }
    if (rpcErr) {
      // Legacy fallback (pre-RPC schema): ONLY when join_game isn't deployed at all (PostgREST
      // can't find the function: PGRST202 / undefined_function / "schema cache"). A real REJECTION
      // from the RPC (game is full / not found / already finished) must surface instead — on
      // PUBLIC games the participants are readable to any signed-in user, so the old blanket
      // fallback would compute seat 9+ and self-insert, silently bypassing the RPC's 8-seat cap
      // and started-gate (G7.61). Reset the speculative online flags before surfacing: we never
      // actually joined, and a stale S.online would let pushAction write into the foreign game.
      var rpcMsg = String((rpcErr && rpcErr.message) || "");
      var fnMissing = (rpcErr && (rpcErr.code === "PGRST202" || rpcErr.code === "42883")) || /could not find the function|schema cache/i.test(rpcMsg);
      if (!fnMissing) { S.online = false; S.gameId = null; throw rpcErr; }
      var ps = await sync.client.from("game_participants").select("*").eq("game_id", gameId).order("seat_index");
      if (ps.error) throw ps.error;
      var existing = ps.data || [];
      var mine = existing.find(function (p) { return p.profile_id === sync.uid(); });
      if (mine) { S.mySeat = mine.seat_index; S.myPart = mine.id; parts = existing; }
      else {
        if (!existing.length) throw rpcErr; // can't see into the game — surface the real join error
        S.mySeat = existing.length;
        var pr = await sync.client.from("game_participants").insert({ game_id: gameId, profile_id: sync.uid(), seat_index: S.mySeat, display_name: opts.displayName || ("Player " + (S.mySeat + 1)), life_total: opts.startingLife || 40 }).select().single();
        if (pr.error) throw pr.error;
        S.myPart = pr.data.id; parts = existing.concat([pr.data]);
      }
    }
    setMaps(parts);
    // Persist my deck if I have no cards in this game yet (fresh join, or rejoin after a failed persist).
    if (deckList && deckList.length) {
      var have = null;
      try { have = await sync.client.from("game_card_instances").select("id", { count: "exact", head: true }).eq("game_id", gameId).eq("owner_participant_id", S.myPart); } catch (e) {}
      if (!have || !have.count) await persistMyCards(buildDeckCards(deckList, null, opts.hand != null ? opts.hand : 7));
    }
    subscribe(); await pull();
    return S.gameId;
  }
  // Reserve my seat in the room WITHOUT entering the board yet (join_game is idempotent — the
  // later Start Game join() finds the same seat). Called from the lobby at deck lock-in and on
  // the host's "gamestart" broadcast so the started-gate can never bounce a player who was
  // legitimately in the lobby into spectator mode. Returns the RPC payload
  // ({seat_index, spectate, ...}), or null when signed out / sync disabled.
  async function reserveSeat(gameId, opts) {
    if (!ready() || !gameId) return null;
    opts = opts || {};
    var r = await sync.client.rpc("join_game", { p_game: gameId, p_display_name: opts.displayName || "Player", p_life: opts.startingLife || 40 });
    if (r.error) throw r.error;
    return r.data || null;
  }

  // Lobby presence only: subscribe to the game's realtime channel for ephemeral presence, WITHOUT a
  // participant insert or state pull — lets a joiner/guest appear in the host's lobby before Start Game.
  function joinLobby(gameId) {
    if (!ready() || !gameId) return false;
    S.gameId = gameId; S.online = true; S.lobbyOnly = true;
    try { subscribe(); } catch (e) { return false; }
    return true;
  }

  // ---- push a committed local action: upsert my changed rows + delete removed + log ----
  // Serialized per client: rapid consecutive actions on the SAME card (tap+declare-attack,
  // move+attach) used to race — every dispatch fired an independent async push and HTTP
  // completion order isn't guaranteed, so an OLDER row-image could commit last and clobber the
  // newer one (lost attack flags / lost attachments under fast play). A promise chain keeps this
  // client's writes in dispatch order; each queued job gets its own stable stateAfter snapshot.
  var _pushChain = Promise.resolve();
  function pushAction(action, stateAfter, changedIds) {
    if (!S.online) return;
    var run = function () { return doPushAction(action, stateAfter, changedIds); };
    _pushChain = _pushChain.then(run, run);
    return _pushChain;
  }
  async function doPushAction(action, stateAfter, changedIds) {
    if (!S.online) return;
    var upserts = [], removed = [], hidUp = [], hidDel = [];
    (changedIds || []).forEach(function (id) {
      var c = stateAfter.cards[id];
      if (c && c.ownerSeat === S.mySeat) {
        upserts.push(toRow(c)); S.lastRows[id] = true;
        if (isHidden(c)) hidUp.push(hiddenRow(c)); else hidDel.push(id); // keep owner-only identity in sync with the card's zone
      } else if (c && S.allowForeign && !c._placeholder && S.seatToPart[c.ownerSeat] != null) {
        // Host-permitted cross-player interaction: push the touched card even though an opponent
        // owns it (the game_card_instances UPDATE policy is game-member-wide). Never track it in
        // lastRows (that set drives DELETEs of my own vanished cards) and never touch their
        // owner-gated hidden-identity rows.
        upserts.push(toRow(c));
      } else if (!c && S.lastRows[id]) { removed.push(id); hidDel.push(id); delete S.lastRows[id]; }
    });
    // Surface write failures (RLS filters, uuid/constraint errors) through onError — supabase
    // returns {error} rather than throwing, so an unchecked result here silently desyncs boards.
    if (upserts.length) { var _ru = await sync.upsertCardInstances(upserts); if (_ru && _ru.error && api.onError) api.onError(_ru.error); }
    if (hidUp.length && sync.upsertHidden) { var _rh = await sync.upsertHidden(hidUp); if (_rh && _rh.error && api.onError) api.onError(_rh.error); }
    if (hidDel.length && sync.deleteHidden) { var _rhd = await sync.deleteHidden(hidDel); if (_rhd && _rhd.error && api.onError) api.onError(_rhd.error); }
    if (removed.length) { var _rd = await sync.deleteCardInstances(removed); if (_rd && _rd.error && api.onError) api.onError(_rd.error); }
    // non-card game state (life / turn / player counters / commander damage) — persist the authoritative post-state
    await syncPlayerState(action, stateAfter);
    // minimal, identity-free action for history/ordering (state syncs via instances, not this payload)
    var seat = action.seat != null ? action.seat : S.mySeat;
    await sync.appendAction({ game_id: S.gameId, action_type: action.t || "sync", payload: { turn: stateAfter.turn, seat: seat, type: action.t } });
  }
  // Write the affected non-card state to the DB (post-state values, not deltas) so opponents' pull() sees it.
  async function syncPlayerState(action, st) {
    try {
      if (!st) return;
      if (action.t === "batch") {
        // Composite gesture (e.g. commander damage + the matching life loss) — persist each
        // sub-action's slice of the post-state so opponents' pull() sees all of it.
        var subs = action.actions || [];
        for (var bi = 0; bi < subs.length; bi++) await syncPlayerState(subs[bi], st);
        return;
      }
      if (action.t === "adjust_life") {
        var pid = S.seatToPart[action.seat], pl = st.players[action.seat];
        if (pid && pl && sync.updateParticipantLife) await sync.updateParticipantLife(pid, pl.life);
      } else if (action.t === "player_counter") {
        var cpid = S.seatToPart[action.seat], cpl = st.players[action.seat];
        if (cpid && cpl && sync.upsertGameCounter) await sync.upsertGameCounter(S.gameId, cpid, action.kind, (cpl.counters && cpl.counters[action.kind]) || 0);
      } else if (action.t === "commander_damage") {
        var tp = S.seatToPart[action.seat], sp = S.seatToPart[action.fromSeat], tpl = st.players[action.seat];
        var key = action.fromSeat + ":" + (action.fromCmd || "primary");
        if (tp && sp && tpl && sync.upsertCommanderDamage) await sync.upsertCommanderDamage(S.gameId, sp, tp, action.fromCmd || "primary", (tpl.cmdDamage && tpl.cmdDamage[key]) || 0);
      } else if (action.t === "set_phase") {
        if (sync.updateGamePhase) await sync.updateGamePhase(S.gameId, st.phase || "main1");
      } else if (action.t === "pass_turn" || action.t === "__set") {
        if (sync.updateGameTurn) await sync.updateGameTurn(S.gameId, st.activeSeat || 0, st.turn || 1);
        if (sync.updateGamePhase) await sync.updateGamePhase(S.gameId, st.phase || "main1"); // __set can carry a phase too
      }
    } catch (e) { if (api.onError) api.onError(e); }
  }

  function isOnline() { return S.online; }
  function info() { return { gameId: S.gameId, mySeat: S.mySeat, seats: Object.keys(S.seatToPart).length }; }
  async function recordWinner(seat, summary) {
    if (!S.online) return; var sum = summary || {}; sum.winnerSeat = seat;
    return await sync.recordMatch(S.gameId, S.seatToPart[seat] || null, sum);
  }
  function leave() { S.online = false; S.gameId = null; }
  // persist (or re-persist) my deck into an already-created room — used by "create room first, bring deck after" (lobby invite button)
  async function persistDeck(deckList, opts) {
    if (!S.online) return null;
    opts = opts || {};
    if (deckList && deckList.length) await persistMyCards(buildDeckCards(deckList, null, opts.hand != null ? opts.hand : 7));
    await pull();
    return S.gameId;
  }

  api.listOpenGames = function (limit) { return (sync && sync.listOpenGames) ? sync.listOpenGames(limit) : Promise.resolve([]); };
  api.lobbyPeek = function (gameId) { return (sync && sync.lobbyPeek) ? sync.lobbyPeek(gameId) : Promise.resolve(null); };
  // Short/custom invite codes (games.invite_code) — resolve a code/UUID to a game id, or (host-only)
  // set the game's code. Thin passthroughs to the web-sync RPC wrappers.
  api.resolveInviteCode = function (code) { return (sync && sync.resolveInviteCode) ? sync.resolveInviteCode(code) : Promise.resolve(null); };
  api.setInviteCode = function (gameId, code) { return (sync && sync.setInviteCode) ? sync.setInviteCode(gameId, code) : Promise.resolve(null); };
  api.broadcastEphemeral = function (payload) { if (sync && sync.broadcastEphemeral) sync.broadcastEphemeral(payload); };
  // Host setting "players may interact with each other's cards": when ON, pushAction may also
  // upsert changed cards that an opponent owns (see the foreign-push branch above).
  api.setForeignPush = function (on) { S.allowForeign = !!on; };
  api.host = host; api.join = join; api.joinLobby = joinLobby; api.reserveSeat = reserveSeat; api.persistDeck = persistDeck; api.pushAction = pushAction; api.pull = pull; api.isOnline = isOnline; api.info = info; api.leave = leave; api.recordWinner = recordWinner;
  return api;
})();

// web-sync.js — Supabase adapter for the Magic Table Tracker.
// Auth + durable game-action log + live card-instance sync for the virtual tabletop.
const MTG_SYNC_CONFIG = window.MTG_SYNC_CONFIG || { enabled: false, supabaseUrl: "", supabaseAnonKey: "" };

// Where auth emails (confirm / reset / OAuth) should land. Over http(s) use the current page;
// over file:// (offline use) fall back to the live site so emailed links still open somewhere real.
// The Supabase dashboard must allowlist this under Authentication → URL Configuration → Redirect URLs.
const MTG_AUTH_REDIRECT = /^https?:$/.test(window.location.protocol)
  ? window.location.origin + window.location.pathname
  : "https://sigil-mtg-web.vercel.app/";
window.mtgAuthRedirectUrl = function () { return MTG_AUTH_REDIRECT; };

class MTGSyncAdapter {
  constructor(config) {
    this.config = config;
    this.enabled = Boolean(config.enabled && config.supabaseUrl && config.supabaseAnonKey && window.supabase);
    this.client = null;
    this.session = null;
    this.currentGameId = null;
    this.channel = null;
  }

  async init() {
    if (!this.enabled) return { mode: "local", message: "Sync disabled; running local table mode." };
    if (!this.client) this.client = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    const { data } = await this.client.auth.getSession();
    this.session = data.session;
    return { mode: this.session ? "synced" : "signed-out", message: this.session ? "Signed in and ready to sync." : "Sign in to sync tables." };
  }

  uid() { return this.session && this.session.user ? this.session.user.id : null; }

  async signInWithEmail(email, password) {
    if (!this.enabled) throw new Error("Sync is not configured.");
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error; this.session = data.session; return data;
  }
  async signUpWithEmail(email, password, displayName) {
    if (!this.enabled) throw new Error("Sync is not configured.");
    // Converting a guest? Upgrade the anonymous account in place — keeps the same user id + game history.
    if (this.session && this.session.user && this.session.user.is_anonymous) {
      const { data, error } = await this.client.auth.updateUser({ email, password, data: { display_name: displayName || "Planeswalker" } });
      if (error) throw error;
      try { this.session = (await this.client.auth.getSession()).data.session; } catch (e) {}
      return data;
    }
    const { data, error } = await this.client.auth.signUp({ email, password, options: { data: { display_name: displayName || "Planeswalker" }, emailRedirectTo: MTG_AUTH_REDIRECT } });
    if (error) throw error; this.session = data.session; return data;
  }
  async resendConfirmation(email) {
    if (!this.enabled) throw new Error("Sync is not configured.");
    const { error } = await this.client.auth.resend({ type: "signup", email: email, options: { emailRedirectTo: MTG_AUTH_REDIRECT } });
    if (error) throw error;
  }
  async signOut() { if (!this.enabled) return; await this.client.auth.signOut(); this.session = null; }
  // Guest sign-in: a temporary anonymous account (real auth.uid, so RLS/join works) with no email/password.
  async signInAnonymously() {
    if (!this.enabled) throw new Error("Sync is not configured.");
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) throw error; this.session = data.session; return data;
  }
  isAnonymous() { return !!(this.session && this.session.user && this.session.user.is_anonymous); }

  // ---- durable action log (object args + caller-supplied client_action_id) [H2] ----
  async appendAction(action) {
    if (!this.enabled || !this.session) return { data: null, error: new Error("not signed in") };
    const row = {
      game_id: action.game_id,
      actor_id: action.actor_id || this.uid(),
      action_type: action.action_type,
      payload: action.payload || {},
      client_action_id: action.client_action_id || (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
      client_created_at: action.client_created_at || new Date().toISOString(),
    };
    return await this.client.from("game_actions").insert(row).select().single();
  }

  // ---- live card-instance state ----
  async upsertCardInstances(rows) {
    if (!this.enabled || !rows || !rows.length) return { data: null, error: null };
    return await this.client.from("game_card_instances").upsert(rows).select();
  }
  async deleteCardInstances(ids) {
    if (!this.enabled || !ids || !ids.length) return { error: null };
    return await this.client.from("game_card_instances").delete().in("id", ids);
  }
  async setHiddenIdentity(row) {
    // owner-only true identity for a face-down card (game_card_hidden)
    if (!this.enabled) return { error: null };
    return await this.client.from("game_card_hidden").upsert(row);
  }
  // owner-only identity store for cards in hidden zones (hand/library/face-down). RLS = owner can read/write only their own.
  async upsertHidden(rows) {
    if (!this.enabled || !rows || !rows.length) return { error: null };
    return await this.client.from("game_card_hidden").upsert(rows);
  }
  async loadHidden(gameId) {
    if (!this.enabled) return [];
    const { data } = await this.client.from("game_card_hidden").select("*").eq("game_id", gameId); // RLS returns only my own rows
    return data || [];
  }
  async deleteHidden(ids) {
    if (!this.enabled || !ids || !ids.length) return { error: null };
    return await this.client.from("game_card_hidden").delete().in("instance_id", ids);
  }
  async loadGameState(gameId) {
    if (!this.enabled) return null;
    const [{ data: game }, { data: participants }, { data: instances }, { data: counters }, { data: cmdDamage }] = await Promise.all([
      this.client.from("games").select("*").eq("id", gameId).maybeSingle(),
      this.client.from("game_participants").select("*").eq("game_id", gameId).order("seat_index"),
      this.client.from("game_card_instances").select("*").eq("game_id", gameId), // RLS hides opponents' hidden zones
      this.client.from("game_counters").select("*").eq("game_id", gameId),
      this.client.from("commander_damage").select("*").eq("game_id", gameId),
    ]);
    return { game, participants: participants || [], instances: instances || [], counters: counters || [], cmdDamage: cmdDamage || [] };
  }
  // ---- non-card game-state writers (life / turn / player counters / commander damage) ----
  async updateParticipantLife(participantId, life) {
    if (!this.enabled || !participantId) return;
    await this.client.from("game_participants").update({ life_total: life }).eq("id", participantId);
  }
  async updateGameTurn(gameId, activeSeatIndex, totalTurns) {
    if (!this.enabled || !gameId) return;
    await this.client.from("games").update({ active_seat_index: activeSeatIndex, total_turns: totalTurns }).eq("id", gameId);
  }
  async updateGamePhase(gameId, phase) {
    if (!this.enabled || !gameId || !phase) return;
    // games.phase arrives with the 20260701120000_games_phase migration; ignore errors on older schemas
    try { await this.client.from("games").update({ phase: phase }).eq("id", gameId); } catch (e) {}
  }
  async upsertGameCounter(gameId, participantId, key, value) {
    if (!this.enabled || !participantId) return;
    await this.client.from("game_counters").upsert({ game_id: gameId, participant_id: participantId, counter_key: key, label: key, value: value }, { onConflict: "participant_id,counter_key" });
  }
  async upsertCommanderDamage(gameId, sourceParticipantId, targetParticipantId, sourceCommander, value) {
    if (!this.enabled || !sourceParticipantId || !targetParticipantId) return;
    await this.client.from("commander_damage").upsert({ game_id: gameId, source_participant_id: sourceParticipantId, target_participant_id: targetParticipantId, source_commander_id: sourceCommander || "primary", value: value }, { onConflict: "source_participant_id,target_participant_id,source_commander_id" });
  }
  async recordMatch(gameId, winnerParticipantId, summary) {
    if (!this.enabled || !this.session) return { error: new Error("not signed in") };
    return await this.client.from("match_history").insert({ game_id: gameId, owner_id: this.uid(), winner_participant_id: winnerParticipantId || null, summary: summary || {} });
  }
  async zoneCounts(gameId) {
    if (!this.enabled) return [];
    const { data } = await this.client.rpc("zone_counts", { p_game: gameId });
    return data || [];
  }
  async listOpenGames(limit = 50) {
    if (!this.enabled) return [];
    const uid = this.uid();
    let q = this.client
      .from("games").select("id,name,starting_life,created_at,owner_id,scheduled_at,visibility")
      .is("completed_at", null);
    // Show every joinable game that isn't finished: all PUBLIC games, plus your OWN games (any visibility).
    q = uid ? q.or(`visibility.eq.public,owner_id.eq.${uid}`) : q.eq("visibility", "public");
    const { data: games, error } = await q.order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    const ids = (games || []).map((g) => g.id);
    const counts = {};
    if (ids.length) {
      const { data: parts } = await this.client.from("game_participants").select("game_id,display_name,seat_index").in("game_id", ids);
      (parts || []).forEach((p) => { (counts[p.game_id] = counts[p.game_id] || []).push(p); });
    }
    return (games || []).map((g) => {
      const ps = counts[g.id] || [];
      const host = ps.find((p) => p.seat_index === 0);
      return { id: g.id, name: g.name, startingLife: g.starting_life, createdAt: g.created_at, scheduledAt: g.scheduled_at || null, players: ps.length, host: host ? host.display_name : "Host", mine: !!(uid && g.owner_id === uid), visibility: g.visibility };
    });
  }

  // ---- realtime: durable changes (postgres_changes) + a Broadcast channel for hot path ----
  subscribeToGame(gameId, onChange, onStatus) {
    if (!this.enabled || !gameId) return null;
    if (this.channel) this.client.removeChannel(this.channel);
    this.currentGameId = gameId;
    const tables = ["games", "game_participants", "game_counters", "commander_damage", "game_actions", "game_card_instances", "dice_rolls"];
    let ch = this.client.channel(`game:${gameId}`, { config: { broadcast: { self: false } } });
    tables.forEach((t) => {
      const filter = t === "games" ? `id=eq.${gameId}` : `game_id=eq.${gameId}`;
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter }, (payload) => onChange({ kind: "db", table: t, payload }));
    });
    ch = ch.on("broadcast", { event: "ephemeral" }, (msg) => onChange({ kind: "ephemeral", payload: msg.payload }));
    this.channel = ch.subscribe((status, err) => { try { if (onStatus) onStatus(status, err); } catch (e) {} });
    return this.channel;
  }
  broadcastEphemeral(payload) {
    if (this.channel) this.channel.send({ type: "broadcast", event: "ephemeral", payload });
  }

  // ---- life-counter helpers (existing; used by the standalone tracker) ----
  toGameRows(state) {
    return {
      game: { starting_life: state.startingLife, layout: state.layout, total_turns: state.totalTurns, turn_cycle: state.turnCycle, turn_tracking_enabled: state.turnTrackingEnabled, active_seat_index: state.playerCount ? state.totalTurns % state.playerCount : 0 },
      participants: state.players.map((player, index) => ({ seat_index: index, display_name: player.name, life_total: player.life, color_index: player.colorIndex, commander_name: player.commanderQuery || null, commander_art_url: player.backgroundUrl || null, commander_tax: player.counters.tax || 0, visible_counter_keys: player.visibleCounterKeys || ["tax"], deck_source: player.deckInput || null, deck_cards: player.deckCards || [], is_dead: player.isDead, death_reason: player.deathReason || null })),
    };
  }
  async createGameFromState(state) {
    if (!this.enabled || !this.session) return null;
    const rows = this.toGameRows(state);
    const { data: game, error } = await this.client.from("games").insert({ owner_id: this.session.user.id, name: "Commander table", starting_life: rows.game.starting_life, layout: rows.game.layout, total_turns: rows.game.total_turns, turn_cycle: rows.game.turn_cycle, turn_tracking_enabled: rows.game.turn_tracking_enabled, active_seat_index: rows.game.active_seat_index }).select().single();
    if (error) throw error;
    const participants = rows.participants.map((p) => ({ ...p, game_id: game.id }));
    const { error: pErr } = await this.client.from("game_participants").insert(participants);
    if (pErr) throw pErr;
    this.currentGameId = game.id;
    return game;
  }
}

window.MTGSyncAdapter = MTGSyncAdapter;
window.mtgSync = new MTGSyncAdapter(MTG_SYNC_CONFIG);

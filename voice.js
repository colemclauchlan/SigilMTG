/*
 * voice.js — in-table voice chat (WebRTC audio mesh) with live speaking detection,
 * per-peer volume / mute, and input/output device selection. window.MTGVoice.
 *
 * ENABLED by default over public STUN. For players behind symmetric NATs a TURN
 * server is still recommended — set BEFORE this script loads:
 *   window.MTG_VOICE_CONFIG = {
 *     enabled: true,                       // set false to hard-disable voice
 *     iceServers: [
 *       { urls: "stun:stun.l.google.com:19302" },
 *       // { urls: "turn:YOUR_TURN_HOST:3478", username: "...", credential: "..." }
 *     ]
 *   };
 *
 * Signaling is transport-agnostic: join() takes a `send(msg)` callback (wired to the
 * Supabase realtime broadcast channel in table.js) and incoming messages are fed to
 * onSignal(msg). Hidden-info etc. is unaffected — this only carries SDP/ICE + a small
 * identity blob (name / seat / commander art) so the UI can draw each speaker.
 * Mesh: every peer connects to every other; the lexicographically-smaller id offers
 * (avoids glare). No TURN creds are ever logged or persisted by this module.
 *
 * Audio graph: remote streams play through per-peer <audio> elements (so volume and
 * setSinkId output routing work), while a WebAudio AnalyserNode taps each stream (and
 * the local mic) purely for level metering / speaking detection — never connected to
 * the destination, so there is no echo of your own mic and no double playback.
 */
window.MTGVoice = (function () {
  "use strict";
  var cfg = window.MTG_VOICE_CONFIG || {};
  var DEFAULT_ICE = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ];
  var enabled = (cfg.enabled === false) ? false : true;   // on by default (STUN)

  var SPEAK_ON = 0.045;   // RMS threshold for "is talking"
  var SPEAK_HANG = 320;   // ms to keep the ring lit after they stop (anti-flicker)

  var S = {
    active: false, gameId: null, selfId: null, send: null, peers: {}, stream: null,
    muted: false, onChange: null, onLevel: null, selfMeta: null,
    ctx: null, localSrc: null, localAna: null, selfLevel: 0, _spk: false, _spkT: 0,
    inputId: null, outputId: null, levelInt: null
  };

  function isEnabled() { return !!enabled; }
  function iceServers() { return (cfg.iceServers && cfg.iceServers.length) ? cfg.iceServers : DEFAULT_ICE; }
  function notify() { if (typeof S.onChange === "function") { try { S.onChange(status()); } catch (e) {} } }

  // ---------- audio context + metering ----------
  function ensureCtx() {
    if (!S.ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) { try { S.ctx = new AC(); } catch (e) {} } }
    if (S.ctx && S.ctx.state === "suspended") { try { S.ctx.resume(); } catch (e) {} }
    return S.ctx;
  }
  function makeAnalyser(stream) {
    var ctx = ensureCtx(); if (!ctx || !stream) return null;
    try {
      var src = ctx.createMediaStreamSource(stream);
      var ana = ctx.createAnalyser(); ana.fftSize = 512; ana.smoothingTimeConstant = 0.6;
      src.connect(ana);                    // tap only — never to ctx.destination
      return { src: src, ana: ana, buf: new Uint8Array(ana.fftSize) };
    } catch (e) { return null; }
  }
  function levelOf(ana, buf) {
    if (!ana) return 0;
    try { ana.getByteTimeDomainData(buf); } catch (e) { return 0; }
    var sum = 0; for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / buf.length);
  }
  function mark(rec, on) {
    if (!rec) return;
    if (on) { rec._spk = true; rec._spkT = Date.now(); }
    else if (rec._spk && (Date.now() - (rec._spkT || 0) > SPEAK_HANG)) { rec._spk = false; }
  }
  function speaking(rec) { return !!(rec && rec._spk); }

  function startLevelLoop() {
    stopLevelLoop();
    S.levelInt = setInterval(function () {
      if (!S.active) return;
      var out = { self: 0, peers: {} };
      var lv = (S.muted || !S.localAna) ? 0 : levelOf(S.localAna.ana, S.localAna.buf);
      S.selfLevel = lv; out.self = lv; mark(S, lv > SPEAK_ON);
      Object.keys(S.peers).forEach(function (id) {
        var p = S.peers[id]; if (p && p.meter) { var v = levelOf(p.meter.ana, p.meter.buf); p.level = v; out.peers[id] = v; mark(p, v > SPEAK_ON); }
      });
      if (typeof S.onLevel === "function") { try { S.onLevel(out); } catch (e) {} }
    }, 90);
  }
  function stopLevelLoop() { if (S.levelInt) { clearInterval(S.levelInt); S.levelInt = null; } }

  // ---------- mic ----------
  function applyMute() { if (S.stream && S.stream.getAudioTracks) S.stream.getAudioTracks().forEach(function (t) { t.enabled = !S.muted; }); }
  function micConstraints(deviceId) {
    var a = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (deviceId) a.deviceId = { exact: deviceId };
    return { audio: a, video: false };
  }
  function getMic(deviceId) { return navigator.mediaDevices.getUserMedia(micConstraints(deviceId)); }
  function setupLocalAnalyser() {
    if (S.localSrc) { try { S.localSrc.disconnect(); } catch (e) {} }
    var m = makeAnalyser(S.stream);
    if (m) { S.localSrc = m.src; S.localAna = { ana: m.ana, buf: m.buf }; }
  }

  // ---------- signaling ----------
  function sig(kind, to, payload) {
    if (S.send) S.send({ type: "voice", kind: kind, from: S.selfId, to: to || null, payload: payload || null, meta: S.selfMeta || null });
  }

  function attachAudio(peerId, stream) {
    var p = S.peers[peerId]; if (!p || !stream) return;
    if (!p.audio) {
      p.audio = document.createElement("audio");
      p.audio.autoplay = true; p.audio.playsInline = true; p.audio.dataset.voicePeer = peerId;
      (document.body || document.documentElement).appendChild(p.audio);
      if (S.outputId && p.audio.setSinkId) { try { p.audio.setSinkId(S.outputId); } catch (e) {} }
    }
    p.audio.srcObject = stream;
    p.audio.volume = p.muted ? 0 : (p.volume == null ? 1 : p.volume);
    if (p.meter && p.meter.src) { try { p.meter.src.disconnect(); } catch (e) {} }
    p.meter = makeAnalyser(stream);   // metering tap (element does the playback)
  }

  function makePeer(peerId, initiator) {
    if (S.peers[peerId]) return S.peers[peerId];
    var pc = new RTCPeerConnection({ iceServers: iceServers() });
    var p = { pc: pc, audio: null, meter: null, meta: null, volume: 1, muted: false, level: 0, _spk: false, _spkT: 0 };
    S.peers[peerId] = p;
    if (S.stream && S.stream.getTracks) S.stream.getTracks().forEach(function (t) { pc.addTrack(t, S.stream); });
    pc.onicecandidate = function (e) { if (e && e.candidate) sig("ice", peerId, e.candidate); };
    pc.ontrack = function (e) { attachAudio(peerId, (e.streams && e.streams[0]) || null); notify(); };
    pc.onconnectionstatechange = function () { notify(); };
    if (initiator) {
      Promise.resolve(pc.createOffer())
        .then(function (o) { return pc.setLocalDescription(o); })
        .then(function () { sig("offer", peerId, pc.localDescription); })
        .catch(function () {});
    }
    notify();
    return p;
  }
  function closePeer(id) {
    var p = S.peers[id]; if (!p) return;
    try { p.pc.close(); } catch (e) {}
    if (p.meter && p.meter.src) { try { p.meter.src.disconnect(); } catch (e) {} }
    if (p.audio && p.audio.remove) { try { p.audio.srcObject = null; } catch (e) {} p.audio.remove(); }
    delete S.peers[id]; notify();
  }

  // ---------- public: session ----------
  async function join(opts) {
    if (!isEnabled()) throw new Error("Voice is disabled. Set window.MTG_VOICE_CONFIG.enabled = true.");
    opts = opts || {};
    S.gameId = opts.gameId; S.selfId = opts.selfId; S.send = opts.send; S.active = true; S.muted = false;
    S.selfMeta = opts.meta || S.selfMeta || null;
    if (opts.onLevel) S.onLevel = opts.onLevel;
    if (opts.onChange) S.onChange = opts.onChange;
    try { S.stream = await getMic(S.inputId); }
    catch (e) {
      // Mic denied/unavailable: fully un-join. S.active was already true, so without this reset
      // the failed join left a half-alive ghost — the next toggle said "Left voice chat" instead
      // of retrying, and incoming offers were still answered with a silent no-track connection.
      S.active = false; S.send = null; notify();
      throw e;
    }
    applyMute();
    ensureCtx(); setupLocalAnalyser(); startLevelLoop();
    sig("join", null, null);            // announce; existing peers respond by offering
    notify();
  }
  function leave() {
    if (S.active) sig("leave", null, null);
    Object.keys(S.peers).forEach(closePeer);
    stopLevelLoop();
    if (S.localSrc) { try { S.localSrc.disconnect(); } catch (e) {} S.localSrc = null; S.localAna = null; }
    if (S.stream && S.stream.getTracks) S.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    S.stream = null; S.active = false; S.selfLevel = 0; S._spk = false;
    notify();
  }
  function setMuted(m) { S.muted = !!m; applyMute(); notify(); return S.muted; }
  function toggleMute() { return setMuted(!S.muted); }

  async function onSignal(msg) {
    if (!msg || msg.type !== "voice" || !S.active) return;
    if (msg.from === S.selfId) return;                 // ignore our own echo
    if (msg.to && msg.to !== S.selfId) return;         // addressed to someone else
    var id = msg.from;
    try {
      if (msg.kind === "join") {
        var pj = makePeer(id, S.selfId < id);          // smaller id offers
        if (msg.meta) { pj.meta = msg.meta; notify(); }
        if (!(S.selfId < id)) sig("hello", id, null);  // let the offerer learn our meta promptly
      } else if (msg.kind === "hello") {
        // Reply from an existing voice member to our join announce. If we have no peer record for
        // them yet, they deliberately did NOT offer (mesh rule: smaller id offers, and their id is
        // the larger one) — so WE must create the peer and make the offer. Without this, any pair
        // where the larger-id side was in voice first deadlocked: the late smaller-id joiner
        // ignored the hello, neither side ever offered, and the dock showed a permanent silent
        // peer on one side only (G7.62).
        var ph = S.peers[id] || makePeer(id, S.selfId < id);
        if (msg.meta) { ph.meta = msg.meta; notify(); }
      } else if (msg.kind === "offer") {
        var p = makePeer(id, false);
        if (msg.meta) p.meta = msg.meta;
        await p.pc.setRemoteDescription(msg.payload);
        var ans = await p.pc.createAnswer();
        await p.pc.setLocalDescription(ans);
        sig("answer", id, p.pc.localDescription);
      } else if (msg.kind === "answer") {
        if (S.peers[id]) { if (msg.meta) S.peers[id].meta = msg.meta; await S.peers[id].pc.setRemoteDescription(msg.payload); notify(); }
      } else if (msg.kind === "ice") {
        if (S.peers[id] && msg.payload) { try { await S.peers[id].pc.addIceCandidate(msg.payload); } catch (e) {} }
      } else if (msg.kind === "leave") {
        closePeer(id);
      }
    } catch (e) { /* signaling errors are non-fatal */ }
  }

  // ---------- public: per-peer mixer ----------
  function setPeerVolume(id, v) {
    var p = S.peers[id]; if (!p) return;
    p.volume = Math.max(0, Math.min(1, Number(v)));
    if (p.audio) p.audio.volume = p.muted ? 0 : p.volume;
    notify();
  }
  function setPeerMuted(id, m) {
    var p = S.peers[id]; if (!p) return;
    p.muted = !!m; if (p.audio) p.audio.volume = p.muted ? 0 : (p.volume == null ? 1 : p.volume);
    notify();
  }

  // ---------- public: devices ----------
  async function listDevices() {
    try {
      var ds = await navigator.mediaDevices.enumerateDevices();
      return {
        inputs: ds.filter(function (d) { return d.kind === "audioinput"; }),
        outputs: ds.filter(function (d) { return d.kind === "audiooutput"; }),
        canPickOutput: typeof (document.createElement("audio").setSinkId) === "function"
      };
    } catch (e) { return { inputs: [], outputs: [], canPickOutput: false }; }
  }
  async function setInputDevice(id) {
    S.inputId = id || null;
    if (!S.active) return;
    try {
      var ns = await getMic(S.inputId);
      var newTrack = ns.getAudioTracks()[0];
      Object.keys(S.peers).forEach(function (pid) {
        var p = S.peers[pid]; if (!p) return;
        try { p.pc.getSenders().forEach(function (s) { if (s.track && s.track.kind === "audio" && newTrack) s.replaceTrack(newTrack); }); } catch (e) {}
      });
      if (S.stream && S.stream.getTracks) S.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      S.stream = ns; applyMute(); setupLocalAnalyser(); notify();
    } catch (e) {}
  }
  function setOutputDevice(id) {
    S.outputId = id || null;
    Object.keys(S.peers).forEach(function (pid) {
      var p = S.peers[pid]; if (p && p.audio && p.audio.setSinkId) { try { p.audio.setSinkId(S.outputId || "default"); } catch (e) {} }
    });
  }
  function getInputDevice() { return S.inputId; }
  function getOutputDevice() { return S.outputId; }

  // A one-shot mic test: opens a stream on `deviceId`, returns a stop() + live level via cb.
  async function testMic(deviceId, onLevel) {
    var stream = await getMic(deviceId || S.inputId);
    var m = makeAnalyser(stream); var raf = null, live = true;
    function tick() { if (!live) return; if (m && onLevel) onLevel(levelOf(m.ana, m.buf)); raf = requestAnimationFrame(tick); }
    tick();
    return function stop() { live = false; if (raf) cancelAnimationFrame(raf); if (m && m.src) { try { m.src.disconnect(); } catch (e) {} } stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); };
  }

  // ---------- public: introspection ----------
  function setSelfMeta(meta) { S.selfMeta = meta || S.selfMeta; notify(); }
  function getSelf() { return { id: S.selfId, meta: S.selfMeta, muted: S.muted, level: S.selfLevel || 0, speaking: speaking(S) }; }
  function getPeers() {
    return Object.keys(S.peers).map(function (id) {
      var p = S.peers[id];
      var cs = p.pc ? (p.pc.connectionState || p.pc.iceConnectionState || "") : "";
      return {
        id: id, meta: p.meta || null, volume: (p.volume == null ? 1 : p.volume), muted: !!p.muted,
        level: p.level || 0, speaking: speaking(p),
        connected: (cs === "connected" || cs === "completed")
      };
    });
  }
  function status() { return { enabled: isEnabled(), active: S.active, muted: S.muted, peers: Object.keys(S.peers).length, selfLevel: S.selfLevel || 0 }; }
  function setOnChange(fn) { S.onChange = fn; }
  function setOnLevel(fn) { S.onLevel = fn; }

  return {
    isEnabled: isEnabled, join: join, leave: leave, setMuted: setMuted, toggleMute: toggleMute,
    onSignal: onSignal, status: status, setOnChange: setOnChange, setOnLevel: setOnLevel,
    setPeerVolume: setPeerVolume, setPeerMuted: setPeerMuted,
    listDevices: listDevices, setInputDevice: setInputDevice, setOutputDevice: setOutputDevice,
    getInputDevice: getInputDevice, getOutputDevice: getOutputDevice, testMic: testMic,
    setSelfMeta: setSelfMeta, getSelf: getSelf, getPeers: getPeers
  };
})();

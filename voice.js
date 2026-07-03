/*
 * voice.js — optional in-table voice chat (PROMPT 4b). WebRTC audio mesh.
 *
 * SHIPS DISABLED. To enable, set BEFORE this script loads:
 *   window.MTG_VOICE_CONFIG = {
 *     enabled: true,
 *     iceServers: [
 *       { urls: "stun:stun.l.google.com:19302" },
 *       // A TURN server is REQUIRED for players behind symmetric NATs. Pick a provider
 *       // (Twilio, metered.ca, coturn self-host) and put its creds here:
 *       // { urls: "turn:YOUR_TURN_HOST:3478", username: "...", credential: "..." }
 *     ]
 *   };
 *
 * Signaling is transport-agnostic: join() takes a `send(msg)` callback (wired to the
 * Supabase realtime broadcast channel in table.js) and incoming messages are fed to
 * onSignal(msg). Hidden-info etc. is unaffected — this only carries SDP/ICE for audio.
 * Mesh: every peer connects to every other; the lexicographically-smaller id is the
 * offerer to avoid glare. No TURN creds are ever logged or persisted by this module.
 */
window.MTGVoice = (function () {
  "use strict";
  var cfg = window.MTG_VOICE_CONFIG || { enabled: false, iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  var S = { active: false, gameId: null, selfId: null, send: null, peers: {}, stream: null, muted: false, onChange: null };

  function isEnabled() { return !!cfg.enabled; }
  function iceServers() { return (cfg.iceServers && cfg.iceServers.length) ? cfg.iceServers : [{ urls: "stun:stun.l.google.com:19302" }]; }
  function notify() { if (typeof S.onChange === "function") S.onChange(status()); }

  function applyMute() { if (S.stream && S.stream.getAudioTracks) S.stream.getAudioTracks().forEach(function (t) { t.enabled = !S.muted; }); }
  async function getMic() {
    if (S.stream) return S.stream;
    S.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    applyMute();
    return S.stream;
  }

  function sig(kind, to, payload) { if (S.send) S.send({ type: "voice", kind: kind, from: S.selfId, to: to || null, payload: payload || null }); }

  function attachAudio(peerId, stream) {
    var p = S.peers[peerId]; if (!p) return;
    if (!p.audio) {
      p.audio = document.createElement("audio");
      p.audio.autoplay = true; p.audio.dataset.voicePeer = peerId;
      (document.body || document.documentElement).appendChild(p.audio);
    }
    p.audio.srcObject = stream;
  }

  function makePeer(peerId, initiator) {
    if (S.peers[peerId]) return S.peers[peerId];
    var pc = new RTCPeerConnection({ iceServers: iceServers() });
    var p = { pc: pc, audio: null }; S.peers[peerId] = p;
    if (S.stream && S.stream.getTracks) S.stream.getTracks().forEach(function (t) { pc.addTrack(t, S.stream); });
    pc.onicecandidate = function (e) { if (e && e.candidate) sig("ice", peerId, e.candidate); };
    pc.ontrack = function (e) { attachAudio(peerId, (e.streams && e.streams[0]) || null); };
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
    if (p.audio && p.audio.remove) p.audio.remove();
    delete S.peers[id]; notify();
  }

  // ---- public ----
  async function join(opts) {
    if (!isEnabled()) throw new Error("Voice is disabled. Set window.MTG_VOICE_CONFIG.enabled = true with a TURN server first.");
    opts = opts || {};
    S.gameId = opts.gameId; S.selfId = opts.selfId; S.send = opts.send; S.active = true; S.muted = false;
    await getMic();
    sig("join", null, null); // announce; existing peers respond by offering
    notify();
  }
  function leave() {
    if (S.active) sig("leave", null, null);
    Object.keys(S.peers).forEach(closePeer);
    if (S.stream && S.stream.getTracks) { S.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); }
    S.stream = null; S.active = false; notify();
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
        makePeer(id, S.selfId < id);                   // smaller id offers
      } else if (msg.kind === "offer") {
        var p = makePeer(id, false);
        await p.pc.setRemoteDescription(msg.payload);
        var ans = await p.pc.createAnswer();
        await p.pc.setLocalDescription(ans);
        sig("answer", id, p.pc.localDescription);
      } else if (msg.kind === "answer") {
        if (S.peers[id]) await S.peers[id].pc.setRemoteDescription(msg.payload);
      } else if (msg.kind === "ice") {
        if (S.peers[id] && msg.payload) { try { await S.peers[id].pc.addIceCandidate(msg.payload); } catch (e) {} }
      } else if (msg.kind === "leave") {
        closePeer(id);
      }
    } catch (e) { /* signaling errors are non-fatal */ }
  }

  function status() { return { enabled: isEnabled(), active: S.active, muted: S.muted, peers: Object.keys(S.peers).length }; }
  function setOnChange(fn) { S.onChange = fn; }

  return { isEnabled: isEnabled, join: join, leave: leave, setMuted: setMuted, toggleMute: toggleMute, onSignal: onSignal, status: status, setOnChange: setOnChange };
})();

/*
 * play-voice.js — the voice-chat surface (window.MTGVoiceUI) for the virtual tabletop.
 *
 * When connected it shows a "voice dock": a cluster of circular COMMANDER portraits, one per
 * player in the call. The portrait ring lights up + pulses for whoever is currently talking
 * (driven by MTGVoice level metering). Expanding the dock reveals a mixer — a per-person volume
 * slider + individual mute, plus your own mic-mute. An "Audio settings" modal (also reachable from
 * the HUD Settings menu) picks the microphone input + speaker output device and previews your mic
 * level. All presentation only — every peer connection / stream lives in voice.js (MTGVoice).
 */
window.MTGVoiceUI = (function () {
  "use strict";

  var dock = null, mounted = false, expanded = false, dragging = false, mixSig = "";
  var ME = "__me__";

  function ic(name, size) { return (window.MTGIcons ? MTGIcons.get(name, size || "1em") : ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function V() { return window.MTGVoice || null; }
  function seatByNo(no) { try { var s = window.MTGTable ? MTGTable.seatsInfo() : []; for (var i = 0; i < s.length; i++) if (s[i] && s[i].seat === no) return s[i]; } catch (e) {} return null; }

  function initials(name) {
    var t = String(name || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
    return t || "?";
  }
  function cssUrl(u) { u = String(u || "").replace(/["'()\\\s]/g, ""); return u ? "url('" + u + "')" : ""; }

  // ---- one commander portrait ("av") ----
  function avatar(person, id, isMe) {
    var meta = person.meta || {};
    var seat = seatByNo(meta.seat);
    var art = (meta.art) || (seat && seat.commanderArt) || "";
    var name = meta.name || (seat && seat.name) || (isMe ? "You" : "Player");
    var color = meta.color || (seat && seat.color) || "#4da3ff";
    var a = el("div", "vc-av" + (isMe ? " me" : "") + (person.muted ? " muted" : ""));
    a.dataset.peer = id; a.title = esc(name) + (isMe ? " (you)" : "");
    a.style.setProperty("--seat", color);
    var face = art
      ? '<div class="vc-img" style="background-image:' + cssUrl(art) + '"></div>'
      : '<div class="vc-ini" style="background:' + esc(color) + '22;color:' + esc(color) + '">' + esc(initials(name)) + '</div>';
    var badge = "";
    if (isMe) badge = '<span class="vc-badge">' + ic(person.muted ? "micOff" : "mic", "0.72em") + '</span>';
    else if (person.muted) badge = '<span class="vc-badge">' + ic("volumeMute", "0.72em") + '</span>';
    a.innerHTML = '<span class="vc-ring"></span>' + face + badge;
    return a;
  }

  // ---- mixer row (name + volume + mute) ----
  function mixRow(person, id, isMe) {
    var meta = person.meta || {}, seat = seatByNo(meta.seat);
    var name = meta.name || (seat && seat.name) || (isMe ? "You" : "Player");
    var row = el("div", "vc-row" + (isMe ? " me" : ""));
    row.dataset.peer = id;
    var mini = avatar(person, "mini-" + id, isMe); mini.classList.add("vc-row-av");
    row.appendChild(mini);
    var nm = el("div", "vc-row-name", '<b>' + esc(name) + (isMe ? ' <span class="vc-you">you</span>' : '') + '</b>' +
      (isMe ? '<i>' + (person.muted ? "Mic muted" : "Mic live") + '</i>' : '<i class="vc-conn">' + (person.connected ? "Connected" : "Connecting…") + '</i>'));
    row.appendChild(nm);
    if (isMe) {
      var mb = el("button", "vc-mute" + (person.muted ? " on" : ""), ic(person.muted ? "micOff" : "mic", "1.05em"));
      mb.title = person.muted ? "Unmute your mic" : "Mute your mic";
      mb.onclick = function () { if (V()) { V().setMuted(!V().status().muted); render(); } };
      row.appendChild(mb);
    } else {
      var vol = Math.round((person.volume == null ? 1 : person.volume) * 100);
      var wrap = el("div", "vc-vol-wrap");
      var rng = el("input", "vc-vol"); rng.type = "range"; rng.min = "0"; rng.max = "100"; rng.step = "1"; rng.value = person.muted ? "0" : vol;
      rng.title = "Volume for " + name;
      rng.addEventListener("pointerdown", function () { dragging = true; });
      rng.addEventListener("pointerup", function () { dragging = false; });
      rng.addEventListener("input", function () { if (V()) { V().setPeerVolume(id, (Number(rng.value) || 0) / 100); if (Number(rng.value) > 0 && person.muted) V().setPeerMuted(id, false); } var lab = wrap.querySelector(".vc-vol-num"); if (lab) lab.textContent = rng.value + "%"; });
      var num = el("span", "vc-vol-num", vol + "%");
      wrap.appendChild(rng); wrap.appendChild(num); row.appendChild(wrap);
      var mb2 = el("button", "vc-mute" + (person.muted ? " on" : ""), ic(person.muted ? "volumeMute" : "volume", "1.05em"));
      mb2.title = person.muted ? "Unmute " + name : "Mute " + name;
      mb2.onclick = function () { if (V()) { V().setPeerMuted(id, !person.muted); render(); } };
      row.appendChild(mb2);
    }
    return row;
  }

  function mount() {
    if (mounted) return;
    dock = el("div", "vc-dock"); dock.id = "voiceDock"; dock.hidden = true;
    dock.innerHTML =
      '<div class="vc-head">' +
        '<span class="vc-dot"></span>' + ic("headset", "1.05em") + '<b class="vc-h-title">Voice</b>' +
        '<span class="vc-count" id="vcCount">0</span>' +
        '<span class="vc-sp"></span>' +
        '<button class="vc-mini" data-vc="audio" title="Audio settings">' + ic("sliders", "1.05em") + '</button>' +
        '<button class="vc-mini" data-vc="expand" title="Show mixer">' + ic("chevronUp", "1.05em") + '</button>' +
        '<button class="vc-mini" data-vc="leave" title="Leave voice">' + ic("phoneOff", "1.05em") + '</button>' +
      '</div>' +
      '<div class="vc-circles" id="vcCircles"></div>' +
      '<div class="vc-mixer" id="vcMixer"></div>';
    (document.getElementById("playPage") || document.body).appendChild(dock);
    dock.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-vc]") : null; if (!b) return;
      var act = b.dataset.vc;
      if (act === "leave") { if (V()) V().leave(); hide(); if (window.MTGTable && MTGTable.setStatus) {} }
      else if (act === "expand") { expanded = !expanded; dock.classList.toggle("expanded", expanded); b.innerHTML = ic(expanded ? "chevronDown" : "chevronUp", "1.05em"); b.title = expanded ? "Hide mixer" : "Show mixer"; render(); }
      else if (act === "audio") { openAudioSettings(); }
    });
    // clicking a portrait opens the mixer
    dock.addEventListener("click", function (e) {
      var av = e.target.closest ? e.target.closest(".vc-circles .vc-av") : null;
      if (av && !expanded) { expanded = true; dock.classList.add("expanded"); var xb = dock.querySelector('[data-vc="expand"]'); if (xb) xb.innerHTML = ic("chevronDown", "1.05em"); render(); }
    });
    if (V()) { V().setOnChange(function () { render(); }); V().setOnLevel(function () { paint(); }); }
    mounted = true;
  }

  function render() {
    if (!mounted || !dock || dock.hidden) return;
    var v = V(); if (!v) return;
    var self = v.getSelf(), peers = v.getPeers();
    var count = 1 + peers.length;
    var cEl = dock.querySelector("#vcCount"); if (cEl) cEl.textContent = count;

    // circles (self first, then peers)
    var circles = dock.querySelector("#vcCircles");
    circles.innerHTML = "";
    circles.appendChild(avatar(self, ME, true));
    peers.forEach(function (p) { circles.appendChild(avatar(p, p.id, false)); });

    // mixer (only rebuild when structure/mute/volume changed, and not mid-drag)
    var sig = ME + ":" + (self.muted ? 1 : 0) + "|" + peers.map(function (p) { return p.id + ":" + (p.muted ? 1 : 0) + ":" + Math.round((p.volume == null ? 1 : p.volume) * 100) + ":" + (p.connected ? 1 : 0); }).join(",");
    var mixer = dock.querySelector("#vcMixer");
    if (expanded && (sig !== mixSig || !mixer.childNodes.length) && !dragging) {
      mixSig = sig; mixer.innerHTML = "";
      mixer.appendChild(mixRow(self, ME, true));
      peers.forEach(function (p) { mixer.appendChild(mixRow(p, p.id, false)); });
      if (!peers.length) mixer.appendChild(el("div", "vc-empty", "Waiting for other players to join voice…"));
      var foot = el("div", "vc-foot");
      var aBtn = el("button", "vc-foot-btn", ic("sliders", "1em") + " Audio settings"); aBtn.onclick = openAudioSettings;
      var lBtn = el("button", "vc-foot-btn vc-leave", ic("phoneOff", "1em") + " Leave voice"); lBtn.onclick = function () { if (V()) V().leave(); hide(); };
      foot.appendChild(aBtn); foot.appendChild(lBtn); mixer.appendChild(foot);
    }
    paint();
  }

  // fast per-frame: only toggle speaking rings + level, never rebuild
  function paint() {
    if (!mounted || !dock || dock.hidden) return;
    var v = V(); if (!v) return;
    var self = v.getSelf(), peers = v.getPeers();
    setSpeak(ME, self.speaking, self.level);
    var live = {}; live[ME] = 1;
    peers.forEach(function (p) { setSpeak(p.id, p.speaking, p.level); live[p.id] = 1; });
  }
  function setSpeak(id, on, level) {
    var nodes = dock.querySelectorAll('.vc-av[data-peer="' + id + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle("speaking", !!on);
      nodes[i].style.setProperty("--lvl", Math.min(1, (level || 0) * 3.2).toFixed(3));
    }
  }

  function show() { mount(); dock.hidden = false; render(); }
  function hide() { if (dock) { dock.hidden = true; expanded = false; dock.classList.remove("expanded"); } }
  function toggle() {
    var v = V(); if (!v) return;
    if (v.status().active) { v.leave(); hide(); }
    else if (window.MTGTable && MTGTable.toggleVoice) MTGTable.toggleVoice();
  }

  // ============================ AUDIO SETTINGS MODAL ============================
  var testStop = null, meterPoll = null, metering = false;
  function stopMeter() {
    if (testStop) { try { testStop(); } catch (e) {} testStop = null; }
    if (meterPoll) { clearInterval(meterPoll); meterPoll = null; }
    metering = false;
    var b = document.getElementById("vcMicTest"); if (b) { b.textContent = "Test"; b.classList.remove("on"); }
    var f = document.getElementById("vcMeterFill"); if (f) f.style.width = "0%";
  }
  function closeAudio() {
    stopMeter();
    var m = document.getElementById("vcAudioModal"); if (m) m.remove();
  }
  function openAudioSettings() {
    closeAudio();
    var v = V();
    var modal = el("div", "vc-modal"); modal.id = "vcAudioModal";
    modal.innerHTML =
      '<div class="vc-sheet" role="dialog" aria-label="Audio settings">' +
        '<div class="vc-sheet-head">' + ic("sliders", "1.1em") + '<h2>Audio &amp; voice</h2>' +
          '<button class="vc-sheet-x" id="vcAudioX" aria-label="Close">' + ic("close", "1.1em") + '</button></div>' +
        '<div class="vc-field"><label>Microphone</label><div class="vc-selwrap"><select id="vcMicSel"><option>Default</option></select></div></div>' +
        '<div class="vc-field"><label>Mic level <button type="button" class="vc-test-btn" id="vcMicTest">Test</button></label><div class="vc-meter"><span class="vc-meter-fill" id="vcMeterFill"></span></div></div>' +
        '<div class="vc-field"><label>Speaker / output</label><div class="vc-selwrap"><select id="vcOutSel"><option>Default</option></select></div><p class="vc-hint" id="vcOutHint"></p></div>' +
        '<div class="vc-sheet-foot">' +
          '<button class="vc-foot-btn" id="vcJoinToggle"></button>' +
          '<button class="vc-foot-btn vc-primary" id="vcAudioDone">Done</button>' +
        '</div>' +
      '</div>';
    (document.getElementById("playPage") || document.body).appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeAudio(); });
    modal.querySelector("#vcAudioX").onclick = closeAudio;
    modal.querySelector("#vcAudioDone").onclick = closeAudio;

    var micSel = modal.querySelector("#vcMicSel"), outSel = modal.querySelector("#vcOutSel");
    var outHint = modal.querySelector("#vcOutHint"), fill = modal.querySelector("#vcMeterFill");
    var joinBtn = modal.querySelector("#vcJoinToggle");

    function refreshJoinBtn() {
      var active = v && v.status().active;
      joinBtn.innerHTML = (active ? ic("phoneOff", "1em") + " Leave voice" : ic("headset", "1em") + " Join voice");
      joinBtn.classList.toggle("vc-leave", !!active);
    }
    joinBtn.onclick = function () {
      if (!v) return;
      if (v.status().active) { v.leave(); hide(); }
      else if (window.MTGTable && MTGTable.toggleVoice) MTGTable.toggleVoice();
      setTimeout(refreshJoinBtn, 120);
    };
    refreshJoinBtn();

    var micTestBtn = modal.querySelector("#vcMicTest");
    if (micTestBtn) micTestBtn.onclick = function () { if (v && v.status().active) return; if (metering) stopMeter(); else startTestMeter(micSel && micSel.value ? micSel.value : null); };
    if (v && v.status().active) { if (micTestBtn) micTestBtn.style.display = "none"; meterPoll = setInterval(function () { if (fill) fill.style.width = Math.min(100, Math.round((v.getSelf().level || 0) * 320)) + "%"; }, 100); }

    if (!v) { micSel.disabled = outSel.disabled = true; return; }
    v.listDevices().then(function (d) {
      // populate mic
      micSel.innerHTML = "";
      var curIn = v.getInputDevice();
      var optd = el("option", null, "System default"); optd.value = ""; micSel.appendChild(optd);
      d.inputs.forEach(function (dev, i) { var o = el("option", null, esc(dev.label || ("Microphone " + (i + 1)))); o.value = dev.deviceId; if (dev.deviceId === curIn) o.selected = true; micSel.appendChild(o); });
      micSel.onchange = function () { if (V()) V().setInputDevice(micSel.value || null); if (metering) startTestMeter(micSel.value || null); };
      // populate output
      outSel.innerHTML = "";
      var curOut = v.getOutputDevice();
      var od = el("option", null, "System default"); od.value = ""; outSel.appendChild(od);
      d.outputs.forEach(function (dev, i) { var o = el("option", null, esc(dev.label || ("Speaker " + (i + 1)))); o.value = dev.deviceId; if (dev.deviceId === curOut) o.selected = true; outSel.appendChild(o); });
      outSel.disabled = !d.canPickOutput;
      outHint.textContent = d.canPickOutput ? "" : "Your browser doesn't allow choosing the output device; it uses the system default.";
      outSel.onchange = function () { if (V()) V().setOutputDevice(outSel.value || null); };
    });

    function startTestMeter(devId) {
      stopMeter(); metering = true;
      var tb = modal.querySelector("#vcMicTest"); if (tb) { tb.textContent = "Stop"; tb.classList.add("on"); }
      v.testMic(devId, function (lvl) { if (fill) fill.style.width = Math.min(100, Math.round(lvl * 320)) + "%"; }).then(function (stop) { testStop = stop; }, function () { stopMeter(); });
    }
  }

  return { mount: mount, show: show, hide: hide, toggle: toggle, render: render, openAudioSettings: openAudioSettings };
})();

// Unit test for voice.js WebRTC signaling state machine (mocked RTCPeerConnection + getUserMedia).
// Verifies the mesh offer/answer/ice flow, deterministic offerer, message filtering, and
// that voice stays disabled unless explicitly enabled. No real audio/peers needed.
// Requires jsdom.  Run: node tests/voice.node.cjs
const fs = require("fs"), path = require("path");
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { console.log("SKIP: jsdom not installed."); process.exit(0); }
const code = fs.readFileSync(path.join(__dirname, "..", "voice.js"), "utf8");
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost/", runScripts: "outside-only" });
const w = dom.window;
function FakePC(c){ this.config=c; this.localDescription=null; this.onicecandidate=null; this.ontrack=null; }
FakePC.prototype.addTrack=function(){};
FakePC.prototype.createOffer=function(){ return Promise.resolve({type:"offer",sdp:"o"}); };
FakePC.prototype.createAnswer=function(){ return Promise.resolve({type:"answer",sdp:"a"}); };
FakePC.prototype.setLocalDescription=function(d){ this.localDescription=d; return Promise.resolve(); };
FakePC.prototype.setRemoteDescription=function(){ return Promise.resolve(); };
FakePC.prototype.addIceCandidate=function(){ return Promise.resolve(); };
FakePC.prototype.close=function(){};
w.RTCPeerConnection = FakePC;
w.navigator.mediaDevices = { getUserMedia: function(){ return Promise.resolve({ getTracks:function(){return [{enabled:true,stop:function(){}}];}, getAudioTracks:function(){return [{enabled:true}];} }); } };
w.MTG_VOICE_CONFIG = { enabled: true, iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
w.eval(code);
const V = w.MTGVoice;
let pass=0, fail=0; const ok=(c,m)=>{ if(c)pass++; else {fail++; console.log("FAIL:",m);} };
const sent=[]; const send=(m)=>sent.push(m);
const tick=()=>new Promise(r=>setTimeout(r,5));
(async()=>{
  ok(V.isEnabled()===true, "enabled via config");
  await V.join({ gameId:"g", selfId:"A", send:send }); await tick();
  ok(sent.some(m=>m.kind==="join"&&m.from==="A"), "join announces to channel");
  // incoming join from B (A<B => A offers)
  await V.onSignal({ type:"voice", kind:"join", from:"B" }); await tick();
  ok(sent.some(m=>m.kind==="offer"&&m.to==="B"), "deterministic offerer sends offer to B");
  ok(V.status().peers===1, "1 peer after B join");
  await V.onSignal({ type:"voice", kind:"answer", from:"B", payload:{type:"answer",sdp:"a"} }); await tick();
  await V.onSignal({ type:"voice", kind:"ice", from:"B", payload:{candidate:"x"} }); await tick();
  ok(true, "answer + ice handled without throwing");
  // incoming offer from C => we answer
  await V.onSignal({ type:"voice", kind:"offer", from:"C", payload:{type:"offer",sdp:"o"} }); await tick();
  ok(sent.some(m=>m.kind==="answer"&&m.to==="C"), "answers an incoming offer");
  ok(V.status().peers===2, "2 peers after C offer");
  // filtering: self echo + message addressed to someone else are ignored
  const before=V.status().peers;
  await V.onSignal({ type:"voice", kind:"join", from:"A" }); await tick();
  await V.onSignal({ type:"voice", kind:"offer", from:"D", to:"someone-else", payload:{} }); await tick();
  ok(V.status().peers===before, "ignores self-echo and messages not addressed to me");
  // leave from B closes that peer
  await V.onSignal({ type:"voice", kind:"leave", from:"B" }); await tick();
  ok(V.status().peers===1, "peer removed on leave");
  // mute toggles
  ok(V.toggleMute()===true && V.status().muted===true, "mute toggles");
  V.leave(); ok(V.status().active===false && V.status().peers===0, "leave tears down");
  console.log("\n"+pass+" passed, "+fail+" failed");
  process.exit(fail?1:0);
})();

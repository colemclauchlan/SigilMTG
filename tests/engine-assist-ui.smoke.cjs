// Smoke test for engine-assist-ui.js (opt-in overlay). Verifies it stays OFF by default and,
// when enabled, builds a panel from MTGTable.getState() + MTGEngineAssist.analyze() with no errors.
// Requires jsdom. Run: node tests/engine-assist-ui.smoke.cjs
let JSDOM;
try { ({ JSDOM } = require("jsdom")); } catch (e) { console.log("SKIP: jsdom not installed."); process.exit(0); }
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "engine-assist-ui.js"), "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL: " + m); } };

function mkWindow(enable) {
  const dom = new JSDOM("<!DOCTYPE html><body></body>", { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const errs = [];
  w.addEventListener("error", (e) => errs.push(e.message));
  if (enable) {
    w.MTG_ENGINE_ASSIST = true;
    w.MTGTable = { getState: () => ({
      seats: 2,
      players: [{ seat: 0, life: 0, counters: {}, cmdDamage: {} }, { seat: 1, life: 40, counters: {}, cmdDamage: {} }],
      cards: { bears: { instanceId: "bears", name: "Grizzly Bears", zone: "battlefield", controllerSeat: 0, counters: { "+1/+1": 2 } } }
    }) };
    w.MTGEngineAssist = { analyze: () => ({ sba: [{ rule: "704.5a", message: "Seat 0 is at 0 life and would lose" }], effective: { bears: { power: 4, toughness: 4 } } }) };
  }
  w.eval(code);
  if (!w.document.getElementById("mtg-engine-assist")) { try { w.document.dispatchEvent(new w.Event("DOMContentLoaded")); } catch (e) {} }
  return { w, errs };
}

// OFF by default
const off = mkWindow(false);
ok(!off.w.document.getElementById("mtg-engine-assist"), "OFF by default: no panel without the flag");

// ON when enabled
const on = mkWindow(true);
const panel = on.w.document.getElementById("mtg-engine-assist");
ok(!!panel, "enabled: overlay panel is created");
ok(/704\.5a|0 life/.test(panel.textContent), "panel shows the SBA finding from the live state");
ok(/4\/4/.test(panel.textContent), "panel shows effective P/T (4/4) for an engine-known creature");
ok(on.errs.length === 0, "no runtime errors (" + (on.errs.join(" || ") || "none") + ")");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

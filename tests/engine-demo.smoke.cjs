// Headless smoke test for engine-demo.html: loads the page (with its real <script src> modules),
// runs the full scripted sample game, and asserts it completes with no runtime errors.
// Requires jsdom. Run: node tests/engine-demo.smoke.cjs
let JSDOM;
try { ({ JSDOM } = require("jsdom")); }
catch (e) { console.log("SKIP: jsdom not installed (npm i jsdom)."); process.exit(0); }
const path = require("path");

(async () => {
  const errs = [];
  const dom = await JSDOM.fromFile(path.join(__dirname, "..", "engine-demo.html"),
    { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true });
  const w = dom.window;
  w.addEventListener("error", (e) => errs.push((e.error && e.error.stack) || e.message));
  w.console.error = function () { errs.push("console.error:" + Array.prototype.join.call(arguments, " ")); };

  await new Promise((r) => setTimeout(r, 900)); // let external module scripts load + reset() run

  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL: " + m); } };

  ok(!!w.MTGEngine && !!w.MTGCore && !!w.MTGCards, "engine modules loaded inside the page");
  const board0 = w.document.getElementById("board").textContent;
  ok(/Seat 0/.test(board0) && /Seat 1/.test(board0), "initial board rendered both seats");

  const runBtn = w.document.getElementById("run");
  ok(!!runBtn, "Run-all button present");
  runBtn.click();
  await new Promise((r) => setTimeout(r, 300));

  const logTxt = w.document.getElementById("log").textContent;
  ok(/end of sample game/.test(logTxt), "full sample game ran to completion");
  ok(/ETB trigger detected/.test(logTxt), "ETB triggered ability fired during the demo");
  ok(/both die/.test(logTxt), "combat step resolved");
  ok(errs.length === 0, "no runtime errors (" + (errs.join(" || ") || "none") + ")");

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: harness threw — " + (e && e.stack || e)); process.exit(1); });

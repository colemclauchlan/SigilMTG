// Headless smoke test for engine-playground.html — loads the page, drives the controls, asserts no errors.
// Requires jsdom. Run: node tests/engine-playground.smoke.cjs
let JSDOM;
try { ({ JSDOM } = require("jsdom")); } catch (e) { console.log("SKIP: jsdom not installed."); process.exit(0); }
const path = require("path");

(async () => {
  const errs = [];
  const dom = await JSDOM.fromFile(path.join(__dirname, "..", "engine-playground.html"),
    { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true });
  const w = dom.window;
  w.addEventListener("error", (e) => errs.push((e.error && e.error.stack) || e.message));
  w.console.error = function () { errs.push("console.error:" + Array.prototype.join.call(arguments, " ")); };

  await new Promise((r) => setTimeout(r, 1000)); // external modules load + reset()

  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL: " + m); } };

  ok(!!w.MTGGame && !!w.MTGCardLibrary && !!w.MTGCombatTurn, "engine modules loaded in the page");
  const sel = w.document.getElementById("cardsel");
  ok(sel && sel.options.length > 10, "card palette populated from the library");
  const board0 = w.document.getElementById("board").textContent;
  ok(/Seat 0/.test(board0) && /Seat 1/.test(board0), "initial board rendered both seats");

  // summon a creature
  sel.value = "Serra Angel";
  w.document.getElementById("summon").click();
  await new Promise((r) => setTimeout(r, 40));
  ok(/Serra Angel/.test(w.document.getElementById("board").textContent), "summoned creature appears on the board");

  // attack, then auto-play a turn
  w.document.getElementById("attack").click();
  await new Promise((r) => setTimeout(r, 40));
  w.document.getElementById("auto").click();
  await new Promise((r) => setTimeout(r, 40));
  w.document.getElementById("pass").click();
  await new Promise((r) => setTimeout(r, 40));

  ok(/end of|to play|auto-played|attacks/i.test(w.document.getElementById("log").textContent), "controls drove the game (log updated)");
  ok(errs.length === 0, "no runtime errors (" + (errs.join(" || ") || "none") + ")");

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: harness threw — " + (e && e.stack || e)); process.exit(1); });

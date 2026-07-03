// One-command test runner for the whole engine suite.
// Run:  node tests/run-all.cjs
// Spawns each tests/*.cjs as its own process, parses "N passed, M failed", and aggregates.
// (jsdom-based smokes self-SKIP if jsdom isn't installed: npm i jsdom)

const cp = require("child_process");
const path = require("path");
const fs = require("fs");

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(function (f) { return /\.cjs$/.test(f) && f !== "run-all.cjs"; })
  .sort();

let total = 0, failed = 0, suites = 0, skipped = 0, errored = 0;

files.forEach(function (f) {
  let out = "";
  try { out = cp.execSync("node " + JSON.stringify(path.join(dir, f)), { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { out = (e.stdout || "") + "\n" + (e.stderr || ""); }

  const m = out.match(/(\d+) passed, (\d+) failed/);
  if (m) {
    const p = +m[1], fl = +m[2];
    total += p; failed += fl; suites++;
    console.log((fl ? "FAIL " : " ok  ") + f.padEnd(36) + p + " passed, " + fl + " failed");
  } else if (/\bSKIP\b/.test(out)) {
    skipped++;
    console.log("skip " + f.padEnd(36) + "(jsdom not installed)");
  } else {
    errored++;
    const firstErr = out.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).pop() || "no output";
    console.log("ERR  " + f.padEnd(36) + firstErr.slice(0, 48));
  }
});

console.log("\n=== " + suites + " suites · " + total + " passed · " + failed + " failed · " + skipped + " skipped · " + errored + " errored ===");
process.exit(failed || errored ? 1 : 0);

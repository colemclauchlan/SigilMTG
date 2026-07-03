// Pure-module test for rules-mana.js (mana payment + casting legality).
// No DOM, no network. Run: node tests/rules-mana.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const M = loadInto({}, "rules-mana.js", "MTGRulesMana");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

// canPay
ok(M.canPay({ R: 1 }, { R: 1 }) === true, "R pays R");
ok(M.canPay({ R: 2 }, { R: 1 }) === false, "not enough R");
ok(M.canPay({ R: 1, generic: 1 }, { R: 1, G: 1 }) === true, "R + 1 generic from G");
ok(M.canPay({ generic: 3 }, { R: 1, G: 1, W: 1 }) === true, "3 generic from 3 mana of any color");
ok(M.canPay({ generic: 3 }, { R: 1, G: 1 }) === false, "not enough total for generic");
ok(M.canPay({ W: 1, U: 1 }, { W: 1, U: 1 }) === true, "WU pays WU");
ok(M.canPay({ W: 1, U: 1 }, { W: 2 }) === false, "two W can't pay W+U");
ok(M.canPay({}, {}) === true, "free spell is payable from nothing");
ok(M.canPay({ C: 1 }, { C: 1 }) === true, "colorless requirement paid by colorless");
ok(M.canPay({ C: 1 }, { R: 1 }) === false, "colorless requirement NOT paid by red");

// pay (returns remaining pool)
const p1 = M.pay({ R: 1, generic: 1 }, { R: 2 });
ok(p1 && p1.R === 0, "pay R+generic from RR -> 0 R left");
const p2 = M.pay({ generic: 1 }, { C: 1, R: 1 });
ok(p2 && p2.C === 0 && p2.R === 1, "generic paid from colorless first (C spent, R kept)");
ok(M.pay({ R: 2 }, { R: 1 }) === null, "pay returns null when unpayable");
const p3 = M.pay({ generic: 2 }, { W: 1, U: 1, R: 1 });
ok(p3 && M.total(p3) === 1, "paying 2 generic from 3 mana leaves 1");

// poolFromCounters
const pool = M.poolFromCounters({ mana_R: 2, mana_G: 1, tax: 5 });
ok(pool.R === 2 && pool.G === 1 && M.total(pool) === 3, "poolFromCounters reads mana_* only, ignores other counters");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

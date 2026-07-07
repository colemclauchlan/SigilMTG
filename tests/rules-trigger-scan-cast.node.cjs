// Test for rules-trigger-scan.js — the CAST / COMBAT-DAMAGE event kinds the live board now emits:
// scan() classification + remindersFor() routing, incl. the controller-scoped watcher rule
// ("whenever you cast" prowess-style watchers fire for their controller's casts only).
// Run: node tests/rules-trigger-scan-cast.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const T = loadInto({}, "rules-trigger-scan.js", "MTGRulesTriggerScan");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

// --- scan() classification ---
(function () {
  const prowess = T.scan("Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.", "Monastery Swiftspear");
  ok(prowess.length === 1 && prowess[0].on === "cast" && prowess[0].scope === "self", "prowess reads as a self-scoped cast trigger");
  const anyCast = T.scan("Whenever a player casts a spell, draw a card.", "Watcher");
  ok(anyCast.length === 1 && anyCast[0].on === "cast" && anyCast[0].scope === "any", "any-player cast reads as scope any");
  const cd = T.scan("Whenever Ohran Frostfang deals combat damage to a player, draw a card.", "Ohran Frostfang");
  ok(cd.length === 1 && cd[0].on === "combat_damage" && cd[0].scope === "self", "combat-damage trigger classified self");
  const cdAny = T.scan("Whenever a creature you control deals combat damage to a player, put a +1/+1 counter on it.", "Coach");
  ok(cdAny.length === 1 && cdAny[0].on === "combat_damage" && cdAny[0].scope === "any", "watched combat damage classified any");
})();

// --- remindersFor(): cast events ---
const meta = {
  swift: { oracle: "Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.", type: "Creature — Human Monk", name: "Swiftspear" },
  bolt: { oracle: "Bolt deals 3 damage to any target.", type: "Instant", name: "Bolt" },
  beacon: { oracle: "Whenever a player casts a spell, draw a card.", type: "Enchantment", name: "Beacon" },
  frost: { oracle: "Whenever this creature deals combat damage to a player, draw a card.", type: "Creature — Snake", name: "Frostfang" },
  plain: { oracle: "", type: "Creature — Bear", name: "Bear" }
};
function getMeta(c) { return meta[c.instanceId] || { oracle: "", type: "", name: c.name || "" }; }
function card(id, seat, zone) { return { instanceId: id, name: (meta[id] || {}).name || id, zone: zone || "battlefield", ownerSeat: seat, controllerSeat: seat }; }

// 1) my prowess watcher fires when I cast a noncreature spell
(function () {
  const game = { cards: { swift: card("swift", 0), bolt: card("bolt", 0, "battlefield") } };
  const rem = T.remindersFor({ kind: "cast", instanceId: "bolt" }, game, getMeta);
  ok(rem.some((r) => r.instanceId === "swift"), "controller's prowess fires on their cast");
})();

// 2) an OPPONENT's prowess does NOT fire for my cast (controller-scoped) [EDGE]
(function () {
  const game = { cards: { swift: card("swift", 1), bolt: card("bolt", 0) } };
  const rem = T.remindersFor({ kind: "cast", instanceId: "bolt" }, game, getMeta);
  ok(!rem.some((r) => r.instanceId === "swift"), "opponent's prowess stays quiet");
})();

// 3) an any-scope cast watcher fires for anyone's cast
(function () {
  const game = { cards: { beacon: card("beacon", 1), bolt: card("bolt", 0) } };
  const rem = T.remindersFor({ kind: "cast", instanceId: "bolt" }, game, getMeta);
  ok(rem.some((r) => r.instanceId === "beacon"), "any-player watcher fires across seats");
})();

// 4) etb watcher semantics unchanged by the controller-scope rule: a "When ~ enters" card still
//    only announces its OWN etb, never another card's [REGRESSION GUARD]
(function () {
  const selfEtb = { self1: { oracle: "When this creature enters, draw a card.", type: "Creature", name: "Self1" } };
  const gm = (c) => selfEtb[c.instanceId] || meta[c.instanceId] || { oracle: "", type: "", name: "" };
  const game = { cards: { self1: card("self1", 0), plain: card("plain", 0) } };
  const rem = T.remindersFor({ kind: "etb", instanceId: "plain" }, game, gm);
  ok(!rem.some((r) => r.instanceId === "self1"), "self-etb watcher ignores another card's etb");
})();

// 5) combat_damage: the attacker's own trigger fires on its event
(function () {
  const game = { cards: { frost: card("frost", 0) } };
  const rem = T.remindersFor({ kind: "combat_damage", instanceId: "frost" }, game, getMeta);
  ok(rem.some((r) => r.instanceId === "frost"), "attacker's combat-damage trigger surfaces");
})();

// 6) combat_damage on a card without the trigger -> nothing [EDGE]
(function () {
  const game = { cards: { plain: card("plain", 0), frost: card("frost", 1) } };
  const rem = T.remindersFor({ kind: "combat_damage", instanceId: "plain" }, game, getMeta);
  ok(!rem.some((r) => r.instanceId === "frost"), "someone else's self combat-damage trigger stays quiet");
  ok(rem.length === 0, "no trigger -> no reminders");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

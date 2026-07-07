// Test for rules-trigger-scan.js — oracle-text triggered-ability scanner feeding the live board's
// advisory trigger tray. scan() classifies "When/Whenever/At" sentences; remindersFor() matches
// board events (etb/dies/attacks/blocks/upkeep/end_step) to self-triggers + battlefield watchers.
// Run: node tests/rules-trigger-scan.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const TS = loadInto(G, "rules-trigger-scan.js", "MTGRulesTriggerScan");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

// ---------- scan(): classification ----------
let r = TS.scan("When Solemn Simulacrum enters the battlefield, search your library for a basic land card.", "Solemn Simulacrum");
ok(r.length === 1 && r[0].on === "etb" && r[0].scope === "self", "named ETB -> etb/self");

r = TS.scan("When this creature enters, draw a card.", "Wall of Omens");
ok(r.length === 1 && r[0].on === "etb" && r[0].scope === "self", "new 'this creature enters' templating -> etb/self");

r = TS.scan("Whenever another creature you control enters, put a +1/+1 counter on it.", "Champion of Lambholt");
ok(r.length === 1 && r[0].on === "etb" && r[0].scope === "other", "watcher ETB -> etb/other");
ok(r[0].typeFilter === "creature" && r[0].yourControl === true, "watcher ETB carries creature filter + your-control");

r = TS.scan("Whenever a creature enters the battlefield, its controller gains 1 life.", "Angel of Vitality");
ok(r.length === 1 && r[0].on === "etb" && r[0].scope === "any" && r[0].yourControl === false, "'a creature enters' -> etb/any");

r = TS.scan("Landfall — Whenever a land you control enters, create a Treasure token.", "Tireless Provisioner");
ok(r.length === 1 && r[0].on === "etb" && r[0].typeFilter === "land" && r[0].yourControl === true, "landfall ability word stripped -> etb land watcher");

r = TS.scan("When Krenko dies, each opponent loses 2 life.", "Krenko, Mob Boss");
ok(r.length === 1 && r[0].on === "dies" && r[0].scope === "self", "short legendary name -> dies/self");

r = TS.scan("Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.", "Blood Artist");
ok(r.length === 1 && r[0].on === "dies" && r[0].scope === "any", "'~ or another creature dies' -> dies/any (self + watcher)");
ok(r[0].typeFilter === "creature", "aristocrat carries creature filter");

r = TS.scan("Whenever Krenko attacks, create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.", "Krenko, Mob Boss");
ok(r.length === 1 && r[0].on === "attacks" && r[0].scope === "self", "attack trigger -> attacks/self");

r = TS.scan("Whenever this creature attacks or blocks, it gets +1/+1 until end of turn.", "Fencer");
ok(r.length === 2 && r[0].on === "attacks" && r[1].on === "blocks", "'attacks or blocks' -> two triggers");

r = TS.scan("At the beginning of your upkeep, draw a card.", "Phyrexian Arena");
ok(r.length === 1 && r[0].on === "upkeep" && r[0].scope === "self", "'your upkeep' -> upkeep/self");

r = TS.scan("At the beginning of each player's upkeep, that player draws a card.", "Howling Mine");
ok(r.length === 1 && r[0].on === "upkeep" && r[0].scope === "any", "'each player's upkeep' -> upkeep/any");

r = TS.scan("At the beginning of each opponent's upkeep, you gain 1 life.", "Karlov Watcher");
ok(r.length === 1 && r[0].on === "upkeep" && r[0].scope === "other", "'each opponent's upkeep' -> upkeep/other");

r = TS.scan("At the beginning of your end step, return a creature card from your graveyard to your hand.", "Palace Siege");
ok(r.length === 1 && r[0].on === "end_step" && r[0].scope === "self", "'your end step' -> end_step/self");

r = TS.scan("Whenever Scytheclaw deals combat damage to a player, that player loses half their life.", "Scytheclaw");
ok(r.length === 1 && r[0].on === "combat_damage" && r[0].scope === "self", "combat damage -> combat_damage/self");

r = TS.scan("Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.", "Monastery Swiftspear");
ok(r.length === 1 && r[0].on === "cast", "prowess-style -> cast (not creature-filtered etb)");

r = TS.scan("Flying\nHaste\nTrample", "Vanilla Flier");
ok(r.length === 0, "static keyword lines -> no triggers");

r = TS.scan("When this creature enters (look at it!), draw a card.", "Reminder Test");
ok(r.length === 1 && r[0].text.indexOf("(") < 0, "reminder text stripped from output");

r = TS.scan("When Mulldrifter enters the battlefield, draw two cards.\nWhen Mulldrifter dies, draw a card.", "Mulldrifter");
ok(r.length === 2 && r[0].on === "etb" && r[1].on === "dies", "multi-line oracle -> one trigger per line");

r = TS.scan("When Cloudgoat Ranger leaves the battlefield, sacrifice a Goblin.", "Cloudgoat Ranger");
ok(r.length === 1 && r[0].on === "other", "'leaves the battlefield' is NOT etb/dies");

r = TS.scan("", "Empty");
ok(r.length === 0 && TS.scan(null, null).length === 0, "empty / null oracle -> []");

// ---------- remindersFor(): event matching over a board ----------
const META = {
  sol: { name: "Solemn Simulacrum", type: "Artifact Creature — Golem", oracle: "When Solemn Simulacrum enters the battlefield, you may search your library for a basic land card.\nWhen Solemn Simulacrum dies, you may draw a card." },
  warden: { name: "Soul Warden", type: "Creature — Human Cleric", oracle: "Whenever another creature enters, you gain 1 life." },
  champ: { name: "Champion of Lambholt", type: "Creature — Human Warrior", oracle: "Whenever another creature you control enters, put a +1/+1 counter on Champion of Lambholt." },
  artist: { name: "Blood Artist", type: "Creature — Vampire", oracle: "Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life." },
  prov: { name: "Tireless Provisioner", type: "Creature — Elf Scout", oracle: "Landfall — Whenever a land you control enters, create a Treasure token." },
  isl: { name: "Island", type: "Basic Land — Island", oracle: "" },
  krenko: { name: "Krenko, Mob Boss", type: "Legendary Creature — Goblin Warrior", oracle: "Tap: Create X 1/1 red Goblin creature tokens.\nWhenever Krenko, Mob Boss attacks, untap it." },
  arena: { name: "Phyrexian Arena", type: "Enchantment", oracle: "At the beginning of your upkeep, you draw a card and you lose 1 life." },
  mine: { name: "Howling Mine", type: "Artifact", oracle: "At the beginning of each player's upkeep, that player draws an additional card." }
};
function getMeta(c) { return META[c.instanceId] || { name: c.name, type: "", oracle: "" }; }
function game(cards) { for (const k in cards) cards[k].instanceId = k; return { cards: cards }; }
function card(zone, seat) { return { zone: zone, controllerSeat: seat, ownerSeat: seat }; }

// ETB: entering card's own trigger + same-controller watcher + any-controller watcher
let g = game({ sol: card("battlefield", 0), warden: card("battlefield", 1), champ: card("battlefield", 0) });
let rem = TS.remindersFor({ kind: "etb", instanceId: "sol" }, g, getMeta);
ok(rem.length === 3, "ETB fires self + any-watcher + your-control watcher (got " + rem.length + ")");
ok(rem.some(x => x.instanceId === "sol") && rem.some(x => x.instanceId === "warden") && rem.some(x => x.instanceId === "champ"), "ETB reminder sources correct");

// your-control watcher must NOT fire for an opponent's creature entering
g = game({ sol: card("battlefield", 1), champ: card("battlefield", 0) });
rem = TS.remindersFor({ kind: "etb", instanceId: "sol" }, g, getMeta);
ok(rem.filter(x => x.instanceId === "champ").length === 0, "your-control watcher skips opponent ETB");
ok(rem.some(x => x.instanceId === "sol"), "self ETB still fires for the opponent's card itself");

// type filter: a LAND entering triggers the landfall watcher but not the creature watchers
g = game({ isl: card("battlefield", 0), warden: card("battlefield", 0), prov: card("battlefield", 0) });
rem = TS.remindersFor({ kind: "etb", instanceId: "isl" }, g, getMeta);
ok(rem.some(x => x.instanceId === "prov"), "landfall watcher fires on land ETB");
ok(!rem.some(x => x.instanceId === "warden"), "creature watcher ignores land ETB");

// dies: the dead card's own dies-trigger + aristocrat watcher (event card sits in the graveyard)
g = game({ sol: card("graveyard", 0), artist: card("battlefield", 1) });
rem = TS.remindersFor({ kind: "dies", instanceId: "sol" }, g, getMeta);
ok(rem.some(x => x.instanceId === "sol"), "own dies trigger fires from the graveyard");
ok(rem.some(x => x.instanceId === "artist"), "aristocrat watcher fires on any creature death");

// Blood Artist's own death triggers itself ("~ or another creature dies" -> scope any)
g = game({ artist: card("graveyard", 1) });
rem = TS.remindersFor({ kind: "dies", instanceId: "artist" }, g, getMeta);
ok(rem.some(x => x.instanceId === "artist"), "'~ or another' fires on its own death");

// attacks: self trigger fires; unrelated upkeep cards stay silent
g = game({ krenko: card("battlefield", 0), arena: card("battlefield", 0) });
rem = TS.remindersFor({ kind: "attacks", instanceId: "krenko" }, g, getMeta);
ok(rem.length === 1 && rem[0].instanceId === "krenko", "attack trigger fires only for the attacker");

// non-battlefield watcher never fires
g = game({ sol: card("battlefield", 0), warden: card("graveyard", 1) });
rem = TS.remindersFor({ kind: "etb", instanceId: "sol" }, g, getMeta);
ok(!rem.some(x => x.instanceId === "warden"), "graveyard watcher is silent");

// upkeep: controller-only trigger vs everyone trigger
g = game({ arena: card("battlefield", 0), mine: card("battlefield", 1) });
rem = TS.remindersFor({ kind: "upkeep", seat: 0 }, g, getMeta);
ok(rem.some(x => x.instanceId === "arena") && rem.some(x => x.instanceId === "mine"), "seat 0 upkeep: own Arena + everyone's Mine fire");
rem = TS.remindersFor({ kind: "upkeep", seat: 1 }, g, getMeta);
ok(!rem.some(x => x.instanceId === "arena") && rem.some(x => x.instanceId === "mine"), "seat 1 upkeep: opponent's Arena silent, Mine fires");

// unknown event card (no meta type) fails open for typed watchers
g = game({ mystery: card("battlefield", 0), warden: card("battlefield", 0) });
rem = TS.remindersFor({ kind: "etb", instanceId: "mystery" }, g, null);
ok(Array.isArray(rem), "missing getMeta tolerated");
rem = TS.remindersFor({ kind: "etb", instanceId: "mystery" }, g, function (c) { return c === g.cards.warden ? META.warden : { name: "Mystery", type: "", oracle: "" }; });
ok(rem.some(x => x.instanceId === "warden"), "unknown type fails open (watcher still reminds)");

// no crash on junk input
ok(TS.remindersFor(null, null, null).length === 0, "null-safe");
ok(TS.remindersFor({ kind: "etb", instanceId: "nope" }, game({}), getMeta).length === 0, "missing event card -> no reminders");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

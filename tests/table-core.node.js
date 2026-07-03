// ESM smoke test. Full suite: `node tests/table-core.node.cjs` or open tests/table-core.test.html.
// (This repo's package.json sets "type":"module", so table-core.js — a classic browser script —
//  is loaded here via a text-eval shim instead of import.)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(dir, "..", "table-core.js"), "utf8");
const MTGCore = new Function("self", "module", code + "\n;return module.exports||self.MTGCore;")({}, { exports: null });
let s = MTGCore.init({ seats: 1, deckSize: 10 });
s = MTGCore.reduce(s, { t: "draw", seat: 0, count: 7 });
const a = { t: "card_move", instanceId: "s0c0", toZone: "battlefield", x: 10, y: 20 };
const round = JSON.stringify(MTGCore.reduce(MTGCore.reduce(s, a), MTGCore.invert(a, s))) === JSON.stringify(s);
const ok = MTGCore.zoneCount(s, 0, "hand") === 7 && MTGCore.zoneCount(s, 0, "library") === 3 && round;
console.log(ok ? "smoke OK (run table-core.node.cjs for the full 51 assertions)" : "smoke FAIL");
process.exit(ok ? 0 : 1);

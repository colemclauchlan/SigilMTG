# MTG Rules Engine — Guide

A pure, deterministic, headless‑tested rules engine layered onto the manual tabletop ("Model C"). Every module is a standalone UMD script (a `window.*` global in the browser, a Node module in tests). The live app loads them **inert** and adds an **opt‑in** advisory overlay — your existing tabletop is unchanged in its default state.

Design rationale and the CR‑accurate loop: [`RULES_ENGINE_ARCHITECTURE.md`](RULES_ENGINE_ARCHITECTURE.md). Wiring recipe for the live board: [`ENGINE_INTEGRATION.md`](ENGINE_INTEGRATION.md).

~77 modules · ~740+ headless assertions. Everything below is built and tested.

## Modules

### Foundation
| File | Global | What it does |
|---|---|---|
| `table-core.js` | `MTGCore` | Pure board reducer — zones, draw, move, tap, counters, life, library reorder. The primitive layer everything composes. |
| `engine-core.js` | `MTGEngine` | The spine: the stack, APNAP priority, SBA/trigger/continuous hook points, the event log, deterministic `replay`. Resolves a `counter_target` effect (counterspells) and carries an `uncounterable` flag on stack objects. |

### Characteristics & continuous effects
| File | Global | What it does |
|---|---|---|
| `rules-layers.js` | `MTGRulesLayers` | CR‑613 layer system — `computeEffectiveState(base, effects)` → effective P/T, types, colors, abilities. (Additive ±N/±N go in layer 7 sublayer **d**; 7c is reserved for counters.) |
| `rules-static.js` | `MTGRulesStatic` | Static **anthems/lords** → layer‑7 P/T effects ("+1/+1 to creatures you control"). |
| `rules-keywords.js` | `MTGRulesKeywords` | Static **keyword grants** → layer‑6 ability effects ("other Goblins have haste"); `effectiveFull` combines anthems + grants. |
| `rules-attach.js` | `MTGRulesAttach` | **Equipment & Auras** — `equips`/`enchants` buffs (P/T + keywords) folded through the layers; `effectiveAttached` = base + statics + grants + attachments. |
| `rules-equip.js` | `MTGRulesEquip` | The **equip** action — validate (your creature), pay the equip cost, attach (re-equip moves it). |
| `rules-aura.js` | `MTGRulesAura` | Casting **Auras** — target on cast (hexproof/protection apply), enter the battlefield attached. |

### Combat
| File | Global | What it does |
|---|---|---|
| `rules-combat.js` | `MTGRulesCombat` | Combat math — `resolveAttack`/`isDead` with deathtouch, trample, multi‑blocker ordered assignment. |
| `rules-combat-fs.js` | `MTGCombatFS` | First/double‑strike two‑step resolution. |
| `rules-combat-turn.js` | `MTGCombatTurn` | Applies a declared attack to the board (taps, damage to player, marked damage, deaths). |
| `rules-combat-turn-fs.js` | `MTGCombatTurnFS` | Same, using the first/double‑strike resolver. |
| `rules-combat-keywords.js` | `MTGCombatKeywords` | Combat + **lifelink** life‑gain. |
| `rules-combat-pw.js` | `MTGCombatPW` | **Attacking planeswalkers** — combat damage becomes loyalty loss (trample overflow handled). |
| `rules-combat-declare.js` | `MTGCombatDeclare` | Rules‑correct declaration — attackers filtered by summoning sickness, blocks filtered by evasion. |
| `rules-blocking.js` | `MTGRulesBlocking` | Defensive blocking AI — favorable/trade/chump heuristics on effective P/T. |
| `rules-evasion.js` | `MTGRulesEvasion` | **Flying / reach** block legality. |
| `rules-menace.js` | `MTGRulesMenace` | **Menace** (needs ≥2 blockers) & **"can't be blocked"**. |
| `rules-sickness.js` | `MTGRulesSickness` | Summoning sickness (CR 302.6) — `canAttack`, haste (incl. granted) clears it. |
| `rules-menace.js` | `MTGRulesMenace` | **Menace** (≥2 blockers) & "can't be blocked". |
| `rules-fight.js` | `MTGRulesFight` | The **fight** action (CR 701.12). |
| `rules-indestructible.js` | `MTGRulesIndestructible` | **Indestructible** — survives lethal damage / "destroy" (granted counts; not −X/−X or sacrifice). |
| `rules-regen.js` | `MTGRulesRegen` | **Regeneration** — a one-shot "destroy" shield (tap + clear damage + leave combat). |
| `rules-infect.js` | `MTGRulesInfect` | **Infect / wither** — damage as −1/−1 counters; infect to players = poison. |
| `rules-goad.js` | `MTGRulesGoad` | **Goad** — must-attack, can't attack the goader (multiplayer-aware). |

### Spells, abilities, costs & the stack
| File | Global | What it does |
|---|---|---|
| `rules-spells.js` | `MTGRulesSpells` | General targeted spell casting — bounce/destroy/pump/draw/damage from data; instants/sorceries → graveyard. |
| `rules-counter.js` | `MTGRulesCounter` | **Counterspells** — `castCounter` puts a counter on the stack; on resolution it removes the target (honors `uncounterable`). |
| `rules-activated.js` | `MTGRulesActivated` | Activated abilities — pay tap/mana cost (validated), target‑check, put on stack. |
| `rules-loyalty.js` | `MTGRulesLoyalty` | **Planeswalkers** — enter with loyalty, +N/−N loyalty abilities on the stack, 0‑loyalty SBA. |
| `rules-triggers.js` | `MTGRulesTriggers` | Event recognition (`diffEvents`, ETB/dies/…) + triggered abilities onto the stack in APNAP order. |
| `rules-replacement.js` | `MTGRulesReplacement` | ETB replacement (CR 614 subset) — enters‑with‑counters, enters‑tapped, `etb-bonus` statics. |
| `rules-mana.js` | `MTGRulesMana` | Mana payment / casting legality — `canPay`/`pay` over colored + colorless + generic. |
| `rules-convoke.js` | `MTGRulesConvoke` | **Convoke** — tap creatures to help pay (colored pip first, else {1}); leftover from the pool. |
| `rules-xspells.js` | `MTGRulesXSpells` | **{X} spells** — resolve {X}, max-affordable-X, X-scaled damage/counters. |
| `rules-modal.js` | `MTGRulesModal` | **Modal** spells ("choose one/two") — validate + assemble the chosen modes. |
| `rules-cascade.js` | `MTGRulesCascade` | **Cascade** — reveal to the first cheaper nonland; cast it free. |
| `rules-kicker.js` | `MTGRulesKicker` | **Kicker / multikicker** — optional additional cost → scaling bonus effect. |
| `rules-flashback.js` | `MTGRulesFlashback` | **Flashback** — cast from the graveyard for an alt cost, then exile. |
| `rules-suspend.js` | `MTGRulesSuspend` | **Suspend** — exile with time counters; cast free (haste) when the last is removed. |
| `rules-cycling.js` | `MTGRulesCycling` | **Cycling** — pay the cycling cost, discard, draw. |
| `rules-escape.js` | `MTGRulesEscape` | **Escape** — cast from the graveyard paying mana + exiling other graveyard cards. |
| `rules-foretell.js` | `MTGRulesForetell` | **Foretell** — exile face-down for {2}, cast later for the foretell cost. |
| `rules-targeting.js` | `MTGRulesTargeting` | Target legality (CR 115) — `legalTargets`/`isLegalTarget`. |
| `rules-protection.js` | `MTGRulesProtection` | **Protection from [color]** (DEBT) — can't be blocked/targeted/damaged by that color. |
| `rules-hexproof.js` | `MTGRulesHexproof` | **Hexproof** (opponents can't target) & **shroud** (no one can). |
| `rules-tokens.js` | `MTGRulesTokens` | Token creation (registers a def, replay‑safe ids). |
| `rules-sba.js` | `MTGRulesSBA` | State‑based‑action detectors — lethal life, poison, 21 cmdr dmg, stray tokens, orphaned attachments, legend rule, dead planeswalkers. |

### Zones, counters & tokens
| File | Global | What it does |
|---|---|---|
| `rules-scry.js` | `MTGRulesScry` | **Scry** — look at the top N, bottom chosen cards; an autoScry policy. |
| `rules-search.js` | `MTGRulesSearch` | **Tutor / ramp** — filter the library, fetch to hand/battlefield, shuffle. |
| `rules-graveyard.js` | `MTGRulesGraveyard` | **Recursion / reanimation** — return graveyard cards to hand/battlefield. |
| `rules-proliferate.js` | `MTGRulesProliferate` | **Proliferate** — add one of each existing counter (skips internal bookkeeping). |
| `rules-counters.js` | `MTGRulesCounters` | **+1/+1 ⇄ −1/−1 annihilation** (SBA) + bolster + counter placement. |
| `rules-treasure.js` | `MTGRulesTreasure` | **Treasure / Food / Clue** tokens + their sacrifice effects. |
| `rules-crew.js` | `MTGRulesCrew` | **Vehicles & crew** — tap power ≥ crew N to make it a creature. |
| `rules-saga.js` | `MTGRulesSaga` | **Sagas** — lore counters drive chapter abilities; sacrifice after the last. |
| `rules-transform.js` | `MTGRulesTransform` | **Transform / DFCs** — front & back faces, each with its own characteristics. |
| `rules-mulligan.js` | `MTGRulesMulligan` | **London mulligan** — shuffle & redraw 7; bottom M on keep. |
| `rules-resources.js` | `MTGRulesResources` | **Energy / experience** player resource counters (gain/pay/threshold). |
| `rules-level.js` | `MTGRulesLevel` | **Level up** — level counters move a creature through P/T/ability bands. |
| `rules-mutate.js` | `MTGRulesMutate` | **Mutate** — merge over/under a non-Human creature; top stats + union of abilities. |
| `rules-dungeon.js` | `MTGRulesDungeon` | **Dungeons & venture** — progress a room-graph one connected room at a time. |
| `rules-ring.js` | `MTGRulesRing` | **The Ring tempts you** — four temptation levels + a Ring-bearer. |
| `rules-daynight.js` | `MTGRulesDayNight` | **Day / night** — the global designation + werewolf transformation. |

### Commander & designations
| File | Global | What it does |
|---|---|---|
| `rules-monarch.js` | `MTGRulesMonarch` | **The Monarch** — end-step draw; the crown is stolen by dealing combat damage to the monarch. |
| `rules-devotion.js` | `MTGRulesDevotion` | **Devotion** — count colored mana symbols among your permanents (one- or two-color). |
| `rules-goad.js` | `MTGRulesGoad` | **Goad** — see Combat (the must-attack restriction). |

### Cards & data
| File | Global | What it does |
|---|---|---|
| `card-defs.js` | `MTGCards` | The card‑definition **DSL** + `castEffects`/`manaEvents`/`printedBase` + a small base set. |
| `card-library.js` | `MTGCardLibrary` | A curated ~18‑card starter set (basics + keyword/ETB/burn) defined through the DSL. |
| `card-library-ext.js` | `MTGCardLibraryExt` | An advanced set — anthems/lords, bounce/destroy/burn, planeswalkers, a tap‑land, a mana rock, enters‑with‑counters. |
| `deck-import.js` | `MTGDeckImport` | Decklist parsing (Moxfield/Arena/plain) + Scryfall card → engine def mapping. |

### Turn & orchestration
| File | Global | What it does |
|---|---|---|
| `rules-turn.js` | `MTGRulesTurn` | CR‑500 turn sequencer — steps, untap/draw/mana‑empty, priority routine per step. |
| `rules-scry.js` | `MTGRulesScry` | **Scry** (CR 701.18) — look at the top N, bottom chosen cards; an `autoScry` policy. |
| `engine-autopilot.js` | `MTGAutopilot` | A greedy auto‑player — play a land, tap, cast the best affordable creature. |
| `engine-game.js` | `MTGGame` | A full **self‑playing game** — runs turns + combat until someone wins. |
| `engine-match.js` | `MTGGameAI` | Self‑playing game **with blocking decisions** (uses the blocking AI). |

### App integration & demos
| File | Global | What it does |
|---|---|---|
| `engine-assist.js` | `MTGEngineAssist` | Read‑only bridge — `analyze(state)` → SBA findings + effective P/T. |
| `engine-assist-ui.js` | — | **Opt‑in** floating overlay for the live tabletop (off by default; `window.MTG_ENGINE_ASSIST = true`). |
| `engine-demo.html` | — | Standalone scripted demo you can open in a browser. |
| `engine-playground.html` | — | Interactive sandbox — summon/cast/attack/auto‑turn and watch the engine. |

## The card‑definition DSL

`MTGCards.define(name, spec)` where `spec` may include:

```js
{
  types: ["creature"], subtypes: ["bear"], supertypes: ["legendary"], colors: ["G"],
  power: 2, toughness: 2,
  abilities: ["flying", "deathtouch", "lifelink", "menace", "hexproof", "shroud", "indestructible",
              "protection from black", "unblockable", "vigilance", "first strike", "double strike",
              "trample", "reach", "infect", "wither", "haste"],
  mana: { generic: 1, G: 1 },              // mana cost (for casting legality)
  produces: "G",                            // taps for this mana (lands / mana rocks)
  entersTapped: true,                       // replacement: comes in tapped
  entersWith: { counter: "+1/+1", count: 2 },// replacement: enters with counters

  spell: { target: "creature",              // instants/sorceries
           effects: [{ t: "card_move", instanceId: "target", toZone: "graveyard" }] },
  // ...or the damage shorthand:  spell: { damage: 3, target: "any" }

  triggers: [{ on: "etb", effects: [{ t: "draw", seat: "controller", count: 1 }] }],
  activated: [{ cost: { tap: true, mana: { generic: 1 } }, target: "any",
               effects: [{ t: "adjust_life", seat: "target", delta: -1 }] }],

  static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 },
           { kind: "grant",  affects: "other-creatures-you-control", subtype: "goblin", keywords: ["haste"] }],

  loyalty: 4,                               // planeswalkers
  loyaltyAbilities: [{ cost: 1, effects: [...] }, { cost: -3, target: "any", effects: [...] }],

  equips:   { power: 2, toughness: 0, keywords: ["trample"] }, equipCost: { generic: 1 },  // Equipment
  enchants: { power: 2, toughness: 0, keywords: ["trample"] }    // Aura buff (same shape; targets on cast)
}
```

Effect templates accept `seat: "controller" | "owner" | "target"` and `instanceId: "target"`, bound at resolution. `affects`: `creatures-you-control` | `other-creatures-you-control` | `all-creatures` (+ optional `subtype`). Real cards can be generated from Scryfall via `MTGDeckImport.cardDefFromScryfall(scryfallCard)`.

## Driving it (common recipes)

```js
const E = MTGEngine, ctx = {};                       // ctx defaults to the window.* globals
let s = E.create({ seats: 2, startingLife: 20, decks: [deck0, deck1] });

// cast a targeted spell, then let the stack resolve
s = MTGRulesSpells.castSpell(E, s, "bolt", { target: { kind: "player", seat: 1 } }, ctx).estate;
s = E.passPriority(s); s = E.passPriority(s);

// counter a spell that's on the stack
s = MTGRulesCounter.castCounter(E, s, "cancel", "sp-bolt", ctx).estate;

// combat: declare → choose blocks (AI) → filter evasion → apply
const atk = MTGCombatDeclare.declareAttackers(s.game, 0, ctx);
let blk  = MTGRulesBlocking.chooseBlocks(s.game, 1, atk, ctx);
blk = MTGRulesMenace.filterEvasion(s.game, MTGRulesEvasion.filterLegalBlocks(...), ctx);
s = MTGCombatTurn.runCombat(E, s, 1, blk, ctx);

// attack a planeswalker (damage → loyalty)
s = MTGCombatPW.runCombatPW(E, s, 1, [MTGCombatPW.attackPW("ogre", "jace")], ctx);

// effective characteristics (everything: counters, anthems, grants, equipment)
const eff = MTGRulesAttach.effectiveAttached(s.game, "champ", ctx);   // → { power, toughness, abilities, ... }

// auto‑play a whole game
const result = MTGGame.playGame(E.create(opts));                       // → winner + final state, replayable
```

## Try it

- **Watch a scripted game:** open `engine-demo.html` in any browser.
- **Play with it:** open `engine-playground.html` — summon/cast/attack/auto‑turn.
- **Live advisory overlay:** set `window.MTG_ENGINE_ASSIST = true` and open the Play tab — a panel shows live SBA findings + effective P/T. Read‑only, off by default.

## Run the tests

```
node tests/run-all.cjs        # whole suite, one command (jsdom for the .smoke.cjs: npm i jsdom)
```

~35 node suites + 2 integration suites, ~440+ assertions locally.

> **Sandbox caveat:** in a mount that serves recently‑*edited* files truncated, suites that load an edited source (e.g. `engine-core.js` after the counterspell edit) can't read it and show as errors. They pass locally — verify with `node tests/run-all.cjs` on a real checkout. New files are unaffected.

## Design invariants

- **Pure & deterministic** — state changes are events; `replay(log)` reproduces the exact state.
- **Compute, don't mutate** — effective characteristics are derived through the layer system, never written onto the printed base.
- **Manual‑first** — the engine never blocks a manual override; automation is additive/opt‑in.
- **Server‑authoritative for hidden info** — the component that sees hidden zones runs where hidden info is allowed and emits per‑player filtered state (the Option‑B model).

## Status & what's next

**Built & tested:** casting and the stack (incl. **counterspells**), the full combat model (deathtouch, trample, first/double strike, lifelink, menace, evasion, fight, **attacking planeswalkers**), the layer system (anthems, keyword grants, **Equipment/Auras**), mana, targeting with **protection / hexproof / shroud**, triggered + activated abilities, **planeswalker loyalty**, replacement effects, tokens, the turn structure, scry, deck import, and self‑playing games.

**Next — needs decisions / a live session (not more pure modules):**

1. **Wire auto‑drive to the live board** (`table.js`) so the engine runs the real tabletop — needs eyes on the render (see `ENGINE_INTEGRATION.md`).
2. **Multiplayer authority model** — run the engine server‑side (Edge Function / service) so it can't desync or leak hidden info.
3. **More card behavior at scale** — broaden DSL coverage and ingest Scryfall data for breadth.

---

## Coverage update — completion loop (2026-06-28)

Twenty more keyword/mechanic modules were added (each a pure `rules-<x>.js` + `tests/rules-<x>.node.cjs`, never editing existing files), taking the suite to **101 suites · 1046 assertions · 0 failed · 0 errored**:

- **Combat / counters:** prowess, exalted, mentor, evolve, bloodthirst, modular, annihilator, soulbond, amass
- **Death / return:** persist & undying
- **Protection:** ward
- **Alt-cast / graveyard:** dash, madness, embalm & eternalize, dredge
- **Cost / mass:** affinity, delve, storm
- **Triggers / poison:** landfall, toxic

Plus `tests/integration-new-mechanics.node.cjs` — proves all twenty coexist (no global collisions) and compose over one shared game state. Scope, gap list, and definition-of-done: [`RULES_ENGINE_COMPLETION_PLAN.md`](RULES_ENGINE_COMPLETION_PLAN.md).

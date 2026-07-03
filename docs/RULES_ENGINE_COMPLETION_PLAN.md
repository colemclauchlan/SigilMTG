# MTG Rules Engine — Completion Plan (XMage-class)

**Goal.** Drive the existing rules engine to a polished, demonstrably-complete state: every core Comprehensive-Rules subsystem implemented, comprehensive keyword/mechanic coverage, and a full-game integration test — all proven by a 100%-green headless suite.

**Baseline (measured).** `node tests/run-all.cjs` → **80 suites · 798 passed · 0 failed**. 77 modules. CR subsystems already done: the stack + APNAP priority (`engine-core`), the CR-613 layer system (`rules-layers`), state-based actions (`rules-sba`), combat (math, first/double strike, lifelink, deathtouch, trample, menace, evasion, fight, attacking planeswalkers), targeting + protection/hexproof/shroud, triggered/activated abilities, mana, replacement effects, planeswalker loyalty, tokens, turn structure, and self-playing games (`engine-game`/`match`/`autopilot`).

## Definition of done (this milestone)
1. **Keyword/mechanic gap set implemented** — each as a pure `rules-<x>.js` module + `tests/rules-<x>.node.cjs`, matching the established pattern (UMD module, `pick(ctx,...)` deps, pure functions; test uses the `loadInto` harness + `ok()` asserts).
2. **Full suite stays 100% green** — `node tests/run-all.cjs` reports `0 failed` after every addition.
3. **A multi-mechanic integration test** exercising several new mechanics together in one scripted game.
4. **Docs updated** — `RULES_ENGINE.md` module table reflects the new coverage.

## Gap set (the loop's work items)
Common, high-value mechanics not yet covered by the 77 modules:

- **Combat / counters:** prowess, exalted, mentor, evolve, bloodthirst, modular, annihilator, soulbond, amass
- **Death / return:** persist & undying
- **Protection variant:** ward
- **Alt-cast / graveyard:** dash, madness, embalm & eternalize, dredge
- **Cost reduction / mass:** affinity, delve, storm
- **Triggers / poison:** landfall (ability-word trigger), toxic

Each is implementable as a pure function over game state (predicate/legality/cost/event-emitter), exactly like `rules-menace.js`.

## Process (the loop)
For each mechanic: write `rules-<x>.js` (pure, self-registering global) → write `tests/rules-<x>.node.cjs` (≥6 assertions incl. a granted/edge case) → `node tests/run-all.cjs` → require `0 failed` → next. Parallelized across agents writing **disjoint files only** (never editing existing modules), with a final authoritative suite run as the gate.

## Out of scope (separate tracks, need Cole / a live session)
- Wiring the engine to drive the live board (`table.js`) — needs eyes on the render (`ENGINE_INTEGRATION.md`).
- Server-authoritative enforcement for multiplayer + hidden info.
- Card-breadth at scale (ingest all of Scryfall) — the DSL supports it; it's data, not engine.

## Done = the gap set merged, `node tests/run-all.cjs` green, integration test passing, docs updated.

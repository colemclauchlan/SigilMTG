# MTG Rules Engine — Backbone Architecture (for review)

**Status:** Design only — no implementation yet. This is the "plan the architecture, you review, *then* we build" step. Nothing here changes the running app; it defines the spine we'd grow into a rules engine (XMage‑class) on top of the working manual tabletop.

**Author:** drafted for Cole's review · 2026‑06‑26

---

## 0. Goal & non‑goals

**Goal.** Define a rules‑engine *spine* that can be layered onto the existing manual virtual tabletop ("Model C") incrementally, so automation can be added card‑by‑card (the way XMage grew) without ever breaking manual play.

**Non‑goals (for v1 of the spine).** Full rules coverage, a card‑scripting library for all ~30k cards, or AI opponents. Those come later and ride on the spine.

**Hard constraint carried over from this week's security work.** The hidden‑information guarantee must survive automation. The authoritative engine sees all zones; clients only ever receive the filtered view (the Option‑B model: opponents get face‑down placeholders + zone counts, never hidden identities). Any engine design that would resolve hidden choices on an untrusted client is rejected.

---

## 1. Guiding principles

- **Manual‑first, engine‑optional.** The engine never *blocks* a human override. Automation is additive and toggle‑able per game (like Tabletop Simulator with optional scripting). This protects the experience we already have.
- **Deterministic & replayable.** The engine is a pure reduction over an ordered event log — the same philosophy as the existing `table-core.js` reducer (`reduce`/`invert`, seeded shuffle). Given the log + seed, any observer recomputes the same state.
- **Server‑authoritative for rules + hidden info.** The component that knows hidden zones runs where hidden info is allowed to live (a server / authoritative host), then emits *per‑player filtered* deltas. This is a direct extension of the RLS + `buildLocalState` model.
- **Compute, don't mutate.** A card's *effective* characteristics (P/T, types, abilities…) are computed on demand by applying continuous effects to its printed base — never by mutating the base. This is the single most important structural decision (see §5).
- **Each phase ships value and keeps tests green** (pure modules tested in isolation, `table-core` style).

---

## 2. What we already have (reuse, don't rebuild)

| Existing piece | Becomes, in the engine |
|---|---|
| `table-core.js` pure reducer (`reduce`/`invert`, seeded shuffle) | The primitive apply‑loop the engine emits *into* when it resolves effects |
| Zone model + `CardInstance` (`game_card_instances`) | The `GameObject` substrate (add: derived characteristics, timestamp) |
| `game_card_hidden` (owner‑only identity) | The hidden‑info boundary the authoritative engine respects when filtering deltas |
| `game_actions` durable log | The ordered **event log** the engine reduces over |
| Phase/step + priority seat tracking (vitals) | The turn structure the priority cycle drives |
| Realtime sync + RLS (Option‑B) | The transport + the per‑player filtering guarantee |

**Key mapping.** A manual `card_move`/`card_tap` action today is exactly the kind of *primitive* the engine will emit tomorrow as the **result** of resolving an ability. So the board renderer doesn't need to change — the engine produces the same primitives a human would.

---

## 3. Core domain model (XMage‑informed, in JS)

XMage models everything as `Ability` → `Cost` + `Target` + `Effect`, observed by `Watcher`s over a central `GameState`. The JS shape:

- **GameObject / CardInstance** — printed data (from Scryfall: name, mana cost, types, subtypes, colors, P/T, oracle abilities) + runtime state (zone, counters, tapped/phased/face‑down, owner/controller, **timestamp**). Printed data is immutable; runtime state is reduced.
- **Characteristics (effective)** — *derived*, never stored: `effective(obj) = applyLayers(printed(obj), activeContinuousEffects)`. (See §5.)
- **Ability** — one of: *static*, *activated* (cost → effect), *triggered* (event → effect), *spell* (the card itself on the stack). Carries `costs[]`, `targets[]`, `effects[]`, timing restrictions.
- **Effect** — *one‑shot* (mutates state once on resolution) or *continuous* (a `ContinuousEffect` with `layer`, optional `sublayer`, `duration`, and `dependency` info).
- **Cost / Target / Choice** — composable, each with `canPay/legalTargets` (validation) and `pay/choose` (mutation) halves. Targets and choices are where hidden info and player input meet — they run authoritatively.
- **Watcher** — pure observers of the event stream answering "what happened (this turn / ever)" for triggers and conditions.
- **Player** — life, mana pool, zones (already in `players[]`), plus pending choices.

---

## 4. The engine loop (CR‑accurate)

Event‑sourced: every state change is an **Event** that other rules can react to. The core cycle — run **every time a player would receive priority**:

1. **Apply continuous effects** → recompute effective state (the layer system, §5).
2. **State‑based actions**: check all SBA conditions simultaneously; perform all applicable ones as one event; **repeat** if anything happened (CR 704).
3. **Put waiting triggers on the stack** in APNAP order (CR 603).
4. **Grant priority** to the active player.

The **stack** is LIFO: resolving the top object runs its effects, then we return to step 1. Priority passes in APNAP; when all players pass with an empty stack, the step/phase advances (we already track phases).

This loop is the heart of the spine and can exist *before* any card is automated — initially it just orchestrates manual actions and SBA *detection*.

---

## 5. Continuous effects: the layer system (CR 613)

The hardest subsystem, and the reason for "compute, don't mutate." Seven layers, always applied in this fixed order regardless of timestamp:

1. Copy · 2. Control · 3. Text‑changing · 4. Type‑changing · 5. Color‑changing · 6. Ability add/remove · 7. Power/Toughness (sublayers 7a CDA, 7b set, 7c counters, 7d +/‑).

Within a layer, **timestamp** order applies, with **dependency** overriding timestamp when one effect changes what another does. Implementation: a **pure** `computeEffectiveState(base, effects)` that sorts by (layer → dependency → timestamp) and folds. Built and tested in isolation exactly like `table-core` (this module is where most rules bugs live, so it earns the heaviest test suite).

---

## 6. State‑based actions & triggered abilities

- **SBAs (CR 704)** — automatic, don't use the stack: 0 life, lethal/deathtouch damage, 0 loyalty, the legend rule, +1/−1 counter annihilation, token/copy cleanup in wrong zones, aura/equipment legality, players drawing from empty libraries, etc. Modeled as pure predicates over `GameState` returning events.
- **Triggered abilities (CR 603)** — `Watcher`s match events; handle "intervening if"; collect since‑last‑priority; place on stack in APNAP with controller‑chosen order among their own.

---

## 7. Determinism, randomness & hidden information

- **Seeded RNG.** All randomness flows from one seeded stream (we already have a deterministic shuffle), so the log replays bit‑identically.
- **Hidden info & the engine.** The authoritative engine sees everything and emits **per‑player filtered deltas** — the same discipline as `buildLocalState` (face‑down placeholders + counts for opponents). Reaffirms Option‑B: hidden identities never leave the server for non‑owners.
- **Authority model (decision needed, §10).** (A) **Server‑authoritative engine** — the engine runs in a trusted server (Supabase Edge Function or a small Node service); clients send *intents*, receive filtered deltas. Strongest, and the natural fit for hidden info. (B) **Deterministic peers with commit‑reveal** for hidden choices — no server compute, but materially more complex and harder to keep leak‑free. **Recommendation: A for v1.**

---

## 8. How it maps onto the current app

- `table-core.js` stays the **manual primitive reducer**. A new **`engine-core.js`** is a *superset* module that, when a game has automation enabled, resolves abilities and **emits the same primitives** (`card_move`, `card_tap`, counter changes…). The renderer is unchanged.
- **Card definitions** are a new layer: parsed ability objects derived from oracle text. We do **not** attempt to auto‑parse all of Scryfall on day one. Like XMage, we hand‑script a small, growing set via a **card‑definition DSL** (a tiny JS vocabulary: mana abilities, vanilla creatures, simple ETB/triggered effects, combat) and expand coverage over time. Scryfall remains the printed‑data source; the DSL adds behavior.

---

## 9. Phased roadmap (manual VTT keeps working throughout)

- **R0 — Spine, no rules.** Formalize `GameState`/`Event` types, the event log, and the priority‑cycle scaffold. Pure modules + tests. Manual still drives everything.
- **R1 — Read‑only assists.** SBA *detection* + trigger *highlights* ("this would die," "ETB would trigger") that the human confirms. Zero authority risk, immediate UX win, validates the watcher/event model.
- **R2 — Continuous‑effects engine (advisory).** The layer system as a pure module; display computed P/T, types, keywords. Still advisory.
- **R3 — Stack + priority.** A real stack with priority passing for a curated card subset; auto‑resolve simple effects.
- **R4 — Card definitions at scale.** The DSL + oracle ingestion; grow coverage mechanic‑by‑mechanic.
- **R5 — Server‑authoritative enforcement.** Move the engine server‑side; clients send intents, server validates and emits filtered deltas. Closes the loop with the hidden‑info model.

Every phase: `table-core`‑style pure‑module tests + integration tests; nothing ships red.

---

## 10. Open decisions for you (before R0)

1. **Where does the engine run for v1?** Edge Function vs. a small dedicated Node service vs. deterministic client. (Recommend: a server‑authoritative service/Edge Function — matches the hidden‑info model.)
2. **Card behavior source:** hand‑scripted DSL + curated set first, vs. attempt oracle‑text parsing. (Recommend: DSL + curated set.)
3. **First automation slice:** which mechanics first? (Recommend: lands/mana, vanilla creatures, simple ETB/triggered, combat math — enough to auto‑run a basic turn.)
4. **Module boundary:** new `engine-core.js` composing `table-core` primitives (recommended) vs. extending `table-core` directly.
5. **Scope of "playgroup.gg parity":** confirm we're matching its *manual* tabletop feel first (done‑ish), with rules automation as a distinct, later track.

---

## 11. Sources

- XMage architecture (Java client/server, full rules enforcement): [magefree/mage (GitHub)](https://github.com/magefree/mage), [DESOSA 2018 — XMage chapter](https://delftswa.gitbooks.io/desosa2018/content/xmage/chapter.html)
- Layer system & timestamps (CR 613): [MTG Wiki — Layer](https://mtg.wiki/page/Layer), [Pocket Judge — How Layers Work](https://www.pocket-judge.com/guides/how-layers-work)
- Stack, priority, state‑based actions, triggers: [MTG Wiki — Stack](https://mtg.fandom.com/wiki/Stack), [MTG Wiki — State‑based action](https://mtg.fandom.com/wiki/State-based_action), [MTG Wiki — Triggered ability](https://mtg.fandom.com/wiki/Triggered_ability)

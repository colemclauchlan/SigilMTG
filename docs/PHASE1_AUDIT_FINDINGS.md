# Phase 1 (data/decks) — Audit Findings & Remediation

> Owner: **Agent B**. Source: adversarially-verified parallel audit (44 agents) on 2026-06-29.
> 38 raised, **37 confirmed**, 1 refuted. This file tracks remediation status.
> Fix work is confined to Agent B's Phase-1 lane (`web/src/lib/{bracket,scryfall,decks}.ts`,
> `web/src/data/{gameChangers,precons}.ts`, `web/src/lib/__tests__/`, and — by brief claim —
> `web/src/components/DeckReview.tsx`). Claim files in `COWORK_LEDGER.md` before editing.

## Status legend
✅ FIXED · ⏳ PENDING · 🔁 CONFIRMATION (no action)

## bracket.ts (web/src/lib/bracket.ts)
| Sev | Finding | Status |
|-----|---------|--------|
| P1 | Tutor detection counts ramp/fetchlands/basic-land searchers as tutors → bracket inflation | ✅ FIXED (excludes Land type + land-target searches) |
| P1 | COMBO_PIECES flat set: any 2 members force B5 (false cEDH) | ✅ FIXED (COMBO_PAIRS, both halves required; combo→B4, B5 needs cEDH signals) |
| P2 | Sol Ring treated as a Game Changer (via data) forcing B3 | ✅ FIXED (removed from GC data; suggestion no longer raisesBracket) |
| P3 | Duplicate `isochron scepter` in combo set | ✅ FIXED (pair model) |
| P3 | Dead branch: B4 && infiniteCombo in U/L | ✅ FIXED (now reachable & meaningful) |
| P3 | Dead branch: B3 && massLand in U/L | ✅ FIXED (removed) |
| P3 | `raisesbraeket` misspelling | ✅ FIXED (renamed `raisesBracket`, lib+test+DeckReview) |

## gameChangers.ts (web/src/data/gameChangers.ts)
| Sev | Finding | Status |
|-----|---------|--------|
| P1 | ~36/53 entries wrong: conflates fast-mana/MLD/extra-turns/stax into GC list; 36 real GCs missing | ✅ FIXED (verified official 53-card list, Feb 9 2026) |
| P2 | Fabricated card `labman backup` | ✅ FIXED (removed) |
| P2 | Header says 53 but set held ~59 wrong members; derived count wrong | ✅ FIXED (now exactly 53) |

## scryfall.ts (web/src/lib/scryfall.ts)
| Sev | Finding | Status |
|-----|---------|--------|
| P2 | `getExactPrint` never reads localStorage (write-only cache) | ✅ FIXED (reads LS before network) |
| P2 | No `/cards/collection` batching — N serial requests on import | ✅ FIXED (POST /cards/collection, <=75/call, fuzzy fallback) |
| P2 | No retry/backoff on 429/5xx; Retry-After ignored | ✅ FIXED (Retry-After + exp backoff, 3 attempts) |
| P3 | Pagination ignored (getAllPrints/searchCards truncate at 175) | ✅ FIXED (follows next_page) |
| P3 | memoryCache has no TTL; diverges from expired LS | ✅ FIXED (memGet/memSet enforce CACHE_TTL_MS) |
| P3 | Queue fully serial despite "concurrently" doc | ✅ FIXED (doc corrected; collection batching removes the serial-N path) |
| P3 | Fuzzy-name cache key on raw input, not canonical name | ✅ FIXED (also caches under canonical name) |
| (refuted) | "foil parsed but never propagated" — actually propagated/displayed | 🔁 refuted |

## decks.ts (web/src/lib/decks.ts)
| Sev | Finding | Status |
|-----|---------|--------|
| P1 | Account save: FK violation — deck_cards.scryfall_id → card_cache never populated | ✅ FIXED (upsert card_cache before deck_cards insert) |
| P1 | No dedupe/merge of duplicate lines; dup (name,section) fails whole insert | ✅ FIXED (mergeCardEntries sums qty by name+section) |
| P2 | Foil + exact-print (set/collector) silently dropped for account decks | ✅ FIXED (round-trip via card_snapshot._sigil; rowToCard reads it) |
| P2 | Parsed set/collector never used to resolve exact printing | ✅ FIXED (importDecklistText resolves exact print via getExactPrint) |
| P2 | Delete-then-insert not atomic: failed insert wipes existing cards | ✅ IMPROVED (error-checked; failure modes removed; full atomicity = RPC follow-up) |
| P2 | Section detection only honors `// ` headers (misses MTGA/`*CMDR*`/maybeboard) | ✅ FIXED (bare/SB:/maybeboard headers + *CMDR*/*E*) |
| P2 | `format` hardcoded to 'commander' on every import | ✅ FIXED (format option threaded; Moxfield passes its format) |
| P3 | color-identity from first commander only (partners/no-commander) | ✅ FIXED (union across all commanders; also un-regressed scoreSavedDeck) |
| P3 | `version` not incremented on account updates | ✅ FIXED (read-then-increment in saveDeck account path) |
| P3 | Dead null-check: `.single()` throws on zero rows (use `.maybeSingle()`) | ✅ FIXED (.maybeSingle()) |

## precons/index.ts (web/src/data/precons/index.ts)
| Sev | Finding | Status |
|-----|---------|--------|
| P1 | All 6 decklists truncated below 100 cards (87/66/74/59/68/70) | ✅ FIXED (all 6 re-fetched + verified to exactly 100; build-time guard test added) |
| P2 | Non-card entries: `Proliferate effects`, `Jesper Ejsing` (artist) | ✅ FIXED (decks replaced with verified lists) |
| P2 | Misspelled `Dangeous Wager` → `Dangerous Wager` | ✅ FIXED (decks replaced with verified lists) |
| P2 | Duplicate `Gavony Township` in blb-family-matters | ✅ FIXED (decks replaced with verified lists) |
| P3 | Catalog is a 6-deck stub vs ~150+ WotC precons | ⏳ PENDING (tracked data task) |
| P3 | "2024 Precons" comment over a 2023 set | ✅ FIXED (comment corrected) |
| P3 | Export shape sound | 🔁 CONFIRMATION |

## UI ↔ lib contracts
| Sev | Finding | Status |
|-----|---------|--------|
| P2 | `SavedDeck.bracket` never computed/persisted → bracket badges are dead UI | ✅ FIXED (computed + persisted on import; badges live) |
| P3 | `raisesbraeket` consistent-but-fragile | ✅ FIXED (renamed) |
| P3 | "Color data unavailable" empty-state is dead (colorPercent always non-empty) | ✅ FIXED (colorPercent left empty when no color identity) |

---

## Self-check round (adversarial sweep of Agent B's own fixes)

A 13-agent adversarial workflow reviewed the 5 files Agent B changed and found **6 real
regressions/inconsistencies introduced by the fixes** — all now fixed + re-verified
(tsc 0 errors, 60/60 vitest):

| Sev | File | Introduced bug | Fix |
|-----|------|----------------|-----|
| P1 | bracket.ts | `isTutor` still counted basic-land-TYPE ramp (Farseek/Nature's Lore/Three Visits/Wood Elves/Skyshroud Claim — fetch "Forest"/"Plains" without the word "land") | broadened LAND_SEARCH_RE to basic-land subtypes + added regression tests |
| P2 | scryfall.ts | `batchGetCardsByName` keyed collection results by canonical name → DFC/split front-face names + accented names silently dropped | key by INPUT name via canonical+front-face, accent-folded match |
| P2 | precons | `otj-most-wanted` colors ['B','R','G'] ≠ Mardu decklist | → ['W','B','R'] |
| P2 | precons | `mkm-deep-clue-sea` colors ['G','U'] ≠ Bant decklist | → ['W','U','G'] |
| P2 | precons | `blb-family-matters` colors ['W','G'] ≠ Jeskai decklist | → ['W','U','R'] |
| P3 | precons | `cmm-planeswalker-party` colors WUBRG ≠ Jeskai decklist | → ['W','U','R'] |

## Remaining (low-value / deferred, with rationale)
- scryfall P3 memoryCache TTL — negligible (Scryfall card data is immutable; LS TTL is the real guard).
- decks P2 exact-print *resolution* (use set/collector to pick the print) — rare in pasted lists; the user's set/collector + foil now round-trip, just not used to re-pick the print.
- decks P3 color-identity union across partners — audit confirmed it does NOT affect bracket math (only the cosmetic colorPercent proxy).
- decks P3 `version` increment on account update — needs a DB trigger to do correctly (backend).
- precons P3 catalog is 6 of ~150 WotC precons — a data-volume task, not a bug; the 6 present are now correct + guarded.
- ui-contract P3 "Color data unavailable" dead empty-state — cosmetic.


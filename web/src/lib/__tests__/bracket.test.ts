/**
 * Vitest unit tests for the Sigil bracket engine.
 * Run: cd web && npx vitest run
 */

import { describe, it, expect } from 'vitest'
import { scoreDeck, scoreDeckByNames, type DeckCard } from '../bracket'

function make(names: string[]): DeckCard[] {
  return names.map((name) => ({ name, quantity: 1 }))
}

// ── Bracket 1 ─────────────────────────────────────────────────────────────────

describe('Bracket 1 — Exhibition', () => {
  it('all lands and vanilla creatures = bracket 1', () => {
    const cards: DeckCard[] = [
      ...Array(64).fill({ name: 'Grizzly Bears', type_line: 'Creature — Bear', quantity: 1 }),
      ...Array(36).fill({ name: 'Forest', type_line: 'Basic Land — Forest', quantity: 1 }),
    ]
    const r = scoreDeck(cards)
    expect(r.bracket).toBe(1)
  })

  it('no tutors no fast mana = bracket 1', () => {
    const r = scoreDeckByNames(['Lightning Bolt', 'Giant Growth', 'Counterspell'])
    expect(r.bracket).toBe(1)
  })
})

// ── Bracket 2 ─────────────────────────────────────────────────────────────────

describe('Bracket 2 — Core', () => {
  it('non-GC tutor (Fabricate) elevates to bracket 2', () => {
    const r = scoreDeck([{ name: 'Fabricate', oracle_text: 'Search your library for an artifact card.', quantity: 1 }])
    expect(r.bracket).toBe(2)
    expect(r.tutorCount).toBe(1)
  })

  it('single non-GC tutor = bracket 2', () => {
    const r = scoreDeck([{ name: 'Fabricate', oracle_text: 'Search your library for an artifact card.', quantity: 1 }])
    expect(r.bracket).toBe(2)
    expect(r.gameChangerCount).toBe(0)
  })

  it('sol ring is fast mana (not a game changer) and scores bracket 2', () => {
    const r = scoreDeckByNames(['Sol Ring'])
    expect(r.bracket).toBe(2)
    expect(r.gameChangerCount).toBe(0)
    expect(r.fastManaCount).toBe(1)
  })
})

// ── Bracket 3 ─────────────────────────────────────────────────────────────────

describe('Bracket 3 — Upgraded', () => {
  it('single game changer = bracket 3', () => {
    const r = scoreDeckByNames(['Demonic Tutor'])
    expect(r.bracket).toBe(3)
    expect(r.gameChangerCount).toBe(1)
  })

  it('exactly 3 game changers stays at bracket 3', () => {
    const r = scoreDeckByNames(['Demonic Tutor', 'Vampiric Tutor', 'Imperial Seal'])
    expect(r.bracket).toBe(3)
    expect(r.gameChangerCount).toBe(3)
  })

  it('3 game changers = upper sub-rating', () => {
    const r = scoreDeckByNames(['Demonic Tutor', 'Vampiric Tutor', 'Imperial Seal'])
    expect(r.subRating).toBe('U')
  })

  it('1 game changer with no stax = lower sub-rating (B3L)', () => {
    const r = scoreDeckByNames(['Demonic Tutor'])
    expect(r.bracket).toBe(3)
    expect(r.subRating).toBe('L')
  })
})

// ── Bracket 4 ─────────────────────────────────────────────────────────────────

describe('Bracket 4 — Optimized', () => {
  it('4 game changers = bracket 4', () => {
    const r = scoreDeckByNames(['Demonic Tutor', 'Vampiric Tutor', 'Imperial Seal', 'Mystical Tutor'])
    expect(r.bracket).toBe(4)
  })

  it('mass land denial alone pushes to bracket 4', () => {
    const r = scoreDeckByNames(['Armageddon'])
    expect(r.bracket).toBe(4)
    expect(r.massLandDenialCount).toBe(1)
    expect(r.flags.massLandDenial).toBe(true)
  })

  it('2 extra-turn cards = bracket 4', () => {
    const r = scoreDeckByNames(['Time Warp', 'Temporal Manipulation'])
    expect(r.bracket).toBe(4)
    expect(r.extraTurnCount).toBe(2)
  })

  it('winter orb = mass land denial flag', () => {
    const r = scoreDeckByNames(['Winter Orb'])
    expect(r.flags.massLandDenial).toBe(true)
  })
})

// ── Bracket 5 ─────────────────────────────────────────────────────────────────

describe('Bracket 5 — cEDH', () => {
  it("thassa's oracle + demonic consultation = bracket 4 (complete 2-card combo)", () => {
    const r = scoreDeckByNames(["Thassa's Oracle", 'Demonic Consultation'])
    expect(r.bracket).toBe(4)
    expect(r.infiniteComboCount).toBe(1)
    expect(r.flags.infiniteCombos).toBe(true)
  })

  it('10+ game changers = bracket 5', () => {
    const gcs = [
      'Demonic Tutor', 'Vampiric Tutor', 'Imperial Seal', 'Mystical Tutor',
      'Enlightened Tutor', 'Worldly Tutor', 'Mana Vault', 'Grim Monolith',
      'Ancient Tomb', 'Chrome Mox', 'Mox Diamond', 'Gamble',
    ]
    const r = scoreDeckByNames(gcs)
    expect(r.bracket).toBe(5)
    expect(r.gameChangerCount).toBeGreaterThanOrEqual(10)
  })
})

// ── Game Changers list ────────────────────────────────────────────────────────

describe('Game Changers list', () => {
  it('demonic tutor is a game changer', () => {
    const r = scoreDeckByNames(['Demonic Tutor'])
    expect(r.gameChangerCount).toBe(1)
  })

  it('basic Forest is not a game changer', () => {
    const r = scoreDeckByNames(['Forest', 'Island', 'Plains'])
    expect(r.gameChangerCount).toBe(0)
  })

  it('case insensitive matching', () => {
    const r = scoreDeckByNames(['DEMONIC TUTOR', 'vampiric tutor'])
    expect(r.gameChangerCount).toBe(2)
  })
})

// ── Type count ────────────────────────────────────────────────────────────────

describe('Type counting', () => {
  it('correctly counts creature and land types', () => {
    const cards: DeckCard[] = [
      { name: 'Grizzly Bears', type_line: 'Creature — Bear', quantity: 4 },
      { name: 'Forest', type_line: 'Basic Land — Forest', quantity: 10 },
      { name: 'Lightning Bolt', type_line: 'Instant', quantity: 3 },
    ]
    const r = scoreDeck(cards)
    expect(r.typeCount['Creature']).toBe(4)
    expect(r.typeCount['Land']).toBe(10)
    expect(r.typeCount['Instant']).toBe(3)
    expect(r.totalCards).toBe(17)
  })
})

// ── Sub-rating U/L ────────────────────────────────────────────────────────────

describe('Sub-rating U/L', () => {
  it('B5 has null sub-rating', () => {
    const r = scoreDeckByNames(["Thassa's Oracle", 'Demonic Consultation', 'Demonic Tutor', 'Vampiric Tutor', 'Mana Vault', 'Grim Monolith'])
    expect(r.bracket).toBe(5)
    expect(r.subRating).toBeNull()
  })

  it('lower-end B2 (non-GC tutor) gets L', () => {
    const r = scoreDeck([{ name: 'Fabricate', oracle_text: 'Search your library for an artifact card.', quantity: 1 }])
    expect(r.bracket).toBe(2)
    expect(r.subRating).toBe('L')
  })

  it('B2 with multiple fast mana gets U', () => {
    const r = scoreDeckByNames(['Sol Ring', 'Lotus Petal', 'Dark Ritual'])
    expect(r.bracket).toBe(2)
    expect(r.subRating).toBe('U')
  })
})

// ── Upgrade suggestions ───────────────────────────────────────────────────────

describe('Upgrade suggestions', () => {
  it('B1 deck gets sol ring suggestion', () => {
    const r = scoreDeck([{ name: 'Grizzly Bears', type_line: 'Creature — Bear', quantity: 1 }])
    const names = r.upgradeSuggestions.map((s) => s.name)
    expect(names).toContain('Sol Ring')
  })

  it('sol ring suggestion is flagged as raising bracket', () => {
    const r = scoreDeck([{ name: 'Grizzly Bears', type_line: 'Creature — Bear', quantity: 1 }])
    const demonic = r.upgradeSuggestions.find((s) => s.name === 'Demonic Tutor')
    expect(demonic?.raisesBracket).toBe(true)
    const solRing = r.upgradeSuggestions.find((s) => s.name === 'Sol Ring')
    expect(solRing?.raisesBracket).toBe(false)
  })

  it('B4 deck gets no basic tutor suggestion', () => {
    const gcs = ['Demonic Tutor', 'Vampiric Tutor', 'Imperial Seal', 'Sol Ring', 'Armageddon']
    const r = scoreDeckByNames(gcs)
    expect(r.bracket).toBeGreaterThanOrEqual(4)
    const hasDemonicTutor = r.upgradeSuggestions.some((s) => s.name === 'Demonic Tutor')
    expect(hasDemonicTutor).toBe(false)
  })
})

// ── scoreDeckByNames convenience ──────────────────────────────────────────────

describe('scoreDeckByNames convenience function', () => {
  it('accepts empty input without throwing', () => {
    const r = scoreDeckByNames([])
    expect(r.bracket).toBeGreaterThanOrEqual(1)
  })

  it('scores a list of names into a bracket', () => {
    const r = scoreDeckByNames(['Sol Ring', 'Demonic Tutor', 'Cyclonic Rift'])
    expect(r.bracket).toBeGreaterThanOrEqual(2)
  })
})

// ── Agent B regression guards (audit fixes — do not delete) ───────────────────

describe('AUDIT regression: tutor detection excludes ramp and lands', () => {
  it('basic-land ramp (Cultivate) is not a tutor', () => {
    const r = scoreDeck([{ name: 'Cultivate', type_line: 'Sorcery', oracle_text: 'Search your library for up to two basic land cards, reveal them, put one onto the battlefield tapped and the other into your hand, then shuffle.', quantity: 1 }])
    expect(r.tutorCount).toBe(0)
    expect(r.bracket).toBe(1)
  })
  it('a fetchland is not a tutor', () => {
    const r = scoreDeck([{ name: 'Flooded Strand', type_line: 'Land', oracle_text: 'Search your library for an Island or Plains card, put it onto the battlefield, then shuffle.', quantity: 1 }])
    expect(r.tutorCount).toBe(0)
  })
  it('a real non-land tutor still counts', () => {
    const r = scoreDeck([{ name: 'Fabricate', type_line: 'Sorcery', oracle_text: 'Search your library for an artifact card, reveal it, put it into your hand, then shuffle.', quantity: 1 }])
    expect(r.tutorCount).toBe(1)
  })
})

describe('AUDIT regression: combo detection requires a real pair', () => {
  it('two unrelated combo-list cards do NOT trigger infinite combo', () => {
    const r = scoreDeckByNames(['Timetwister', 'Windfall', 'Basalt Monolith', 'Walking Ballista'])
    expect(r.infiniteComboCount).toBe(0)
    expect(r.flags.infiniteCombos).toBe(false)
  })
  it('a complete pair (Heliod + Walking Ballista) triggers infinite combo', () => {
    const r = scoreDeckByNames(['Heliod, Sun-Crowned', 'Walking Ballista'])
    expect(r.infiniteComboCount).toBe(1)
    expect(r.flags.infiniteCombos).toBe(true)
  })
})

describe('AUDIT regression: Game Changers list accuracy', () => {
  it('Sol Ring is NOT a game changer', () => {
    expect(scoreDeckByNames(['Sol Ring']).gameChangerCount).toBe(0)
  })
  it('Dark Ritual / Armageddon / Time Walk are NOT game changers', () => {
    expect(scoreDeckByNames(['Dark Ritual', 'Armageddon', 'Time Walk']).gameChangerCount).toBe(0)
  })
  it('Rhystic Study and Cyclonic Rift ARE game changers', () => {
    expect(scoreDeckByNames(['Rhystic Study', 'Cyclonic Rift']).gameChangerCount).toBe(2)
  })
})

describe('AUDIT regression: basic-land-type ramp is not a tutor', () => {
  const ramp = [
    { name: 'Farseek', type_line: 'Sorcery', oracle_text: 'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield, then shuffle.' },
    { name: "Nature's Lore", type_line: 'Sorcery', oracle_text: 'Search your library for a Forest card, put that card onto the battlefield, then shuffle.' },
    { name: 'Three Visits', type_line: 'Sorcery', oracle_text: 'Search your library for a Forest card, put that card onto the battlefield, then shuffle.' },
    { name: 'Wood Elves', type_line: 'Creature \u2014 Elf Scout', oracle_text: 'When Wood Elves enters the battlefield, search your library for a Forest card, put it onto the battlefield, then shuffle.' },
    { name: 'Skyshroud Claim', type_line: 'Sorcery', oracle_text: 'Search your library for up to two Forest cards, put them onto the battlefield, then shuffle.' },
  ]
  for (const c of ramp) {
    it(`${c.name} is not counted as a tutor`, () => {
      expect(scoreDeck([{ ...c, quantity: 1 }]).tutorCount).toBe(0)
    })
  }
  it('a deck of basic-land-type ramp stays bracket 1-2, not pushed by tutors', () => {
    const r = scoreDeck(ramp.map((c) => ({ ...c, quantity: 1 })))
    expect(r.tutorCount).toBe(0)
    expect(r.flags.tutorDensity).toBe(false)
  })
})

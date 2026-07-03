/**
 * Sigil — Commander Bracket engine
 *
 * Pure module — no React, no Supabase, no side effects.
 * Unit-tested via Vitest (see web/src/lib/__tests__/bracket.test.ts).
 *
 * Brackets (WotC Commander Brackets Beta, Feb 2026):
 *   1 Exhibition — casual/beginner, no power
 *   2 Core       — precon-level, no Game Changers
 *   3 Upgraded   — up to 3 Game Changers
 *   4 Optimized  — high-power, unrestricted Game Changers
 *   5 cEDH       — competitive
 *
 * Sub-rating U/L (within a bracket):
 *   U = Upper — deck trends toward the next bracket
 *   L = Lower — deck is comfortably inside the bracket
 *
 * Sources: https://magic.wizards.com/en/commander-brackets
 */

import { isGameChanger } from '../data/gameChangers'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Bracket = 1 | 2 | 3 | 4 | 5
export type SubRating = 'U' | 'L' | null

export interface DeckCard {
  name: string
  type_line?: string
  oracle_text?: string
  cmc?: number
  quantity?: number
}

export interface BracketFlags {
  gameChangers: boolean      // ≥1 Game Changer card present
  massLandDenial: boolean    // ≥1 mass-land-denial card
  extraTurns: boolean        // ≥1 extra-turn card
  tutorDensity: boolean      // ≥4 tutors
  infiniteCombos: boolean    // >=1 complete 2-card infinite combo
  fastMana: boolean          // ≥3 fast-mana cards
}

export interface UpgradeSuggestion {
  name: string
  reason: string
  raisesBracket: boolean
}

export interface BracketResult {
  bracket: Bracket
  subRating: SubRating
  // Raw counts
  gameChangerCount: number
  massLandDenialCount: number
  extraTurnCount: number
  tutorCount: number
  fastManaCount: number
  infiniteComboCount: number
  totalCards: number
  // Breakdowns
  colorPercent: Record<string, number>
  typeCount: Record<string, number>
  // Flags: does each category push bracket higher?
  flags: BracketFlags
  // Suggestions
  upgradeSuggestions: UpgradeSuggestion[]
}

// ── Card lists ────────────────────────────────────────────────────────────────

const MASS_LAND_DENIAL = new Set([
  "armageddon", "ravages of war", "catastrophe", "devastation",
  "obliterate", "jokulhaups", "decree of annihilation", "boom // bust",
  "winter orb", "stasis", "static orb", "land equilibrium",
  "mana vortex", "sunder", "upheaval", "global ruin",
  "ruination", "flashfires", "choke", "impending disaster",
])

const EXTRA_TURN = new Set([
  "time walk", "temporal manipulation", "time warp",
  "capture of jingzhou", "temporal mastery", "expropriate",
  "nexus of fate", "beacon of tomorrows", "part the waterveil",
  "all in good time", "karn's temporal sundering",
  "savor the moment", "walk the aeons", "final fortune", "last chance",
  "warrior's oath", "taking turns", "magistrate's scepter",
  "lighthouse chronologist", "ugin's nexus",
  "alrund's epiphany", "wanderwine hub",
])

const FAST_MANA = new Set([
  "sol ring", "mana crypt", "mana vault", "grim monolith",
  "ancient tomb", "chrome mox", "mox diamond", "mox opal",
  "lotus petal", "jeweled lotus", "dark ritual", "cabal ritual",
  "elvish spirit guide", "simian spirit guide",
  "rite of flame", "pyretic ritual", "desperate ritual",
  "seething song", "culling the weak",
])

/**
 * Known 2-card infinite combos, modelled as explicit PAIRS.
 * A combo is only counted when BOTH halves of the same pair are present --
 * unlike a flat set, two unrelated members never falsely trip a combo.
 */
const COMBO_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["thassa's oracle", "demonic consultation"],
  ["thassa's oracle", "tainted pact"],
  ["jace, wielder of mysteries", "demonic consultation"],
  ["laboratory maniac", "demonic consultation"],
  ["splinter twin", "deceiver exarch"],
  ["splinter twin", "pestermite"],
  ["kiki-jiki, mirror breaker", "deceiver exarch"],
  ["kiki-jiki, mirror breaker", "pestermite"],
  ["kiki-jiki, mirror breaker", "restoration angel"],
  ["heliod, sun-crowned", "walking ballista"],
  ["mikaeus, the unhallowed", "triskelion"],
  ["sanguine bond", "exquisite blood"],
  ["exquisite blood", "vito, thorn of the dusk rose"],
  ["dramatic reversal", "isochron scepter"],
  ["deadeye navigator", "palinchron"],
  ["basalt monolith", "rings of brighthearth"],
  ["grim monolith", "power artifact"],
  ["devoted druid", "swift reconfiguration"],
]

const TUTOR_NAME_RE = /tutor/i
const SEARCH_LIBRARY_RE = /search your (?:library|deck)/
// A search clause whose target is a land = ramp / fixing, not a power tutor.
const LAND_SEARCH_RE = /search your (?:library|deck) for [^.]*\b(?:land|plains|island|swamp|mountain|forest|wastes)\b/

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(name: string): string {
  return name.toLowerCase().trim()
}

function isTutor(card: DeckCard): boolean {
  if (TUTOR_NAME_RE.test(card.name)) return true
  const text = card.oracle_text
  if (!text) return false
  // The card itself is a land (fetchland, Evolving Wilds, etc.) -> ramp/fixing.
  if (/\bLand\b/.test(card.type_line ?? '')) return false
  const t = text.toLowerCase()
  if (!SEARCH_LIBRARY_RE.test(t)) return false
  if (LAND_SEARCH_RE.test(t)) return false
  return true
}

function mainType(typeLine: string): string {
  const types = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land', 'Battle']
  for (const t of types) if (typeLine.includes(t)) return t
  return 'Other'
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Score a deck and return a full BracketResult.
 *
 * @param cards          All cards in the deck (commander included)
 * @param colorIdentity  Commander's color identity e.g. ['U','B']
 */
export function scoreDeck(
  cards: DeckCard[],
  colorIdentity: string[] = [],
): BracketResult {
  // Expand by quantity
  const expanded: DeckCard[] = cards.flatMap((c) => Array(c.quantity ?? 1).fill(c))
  const total = expanded.length

  let gcCount = 0
  let massLandCount = 0
  let extraTurnCount = 0
  let tutorCount = 0
  let fastManaCount = 0
  const namesPresent = new Set<string>()
  const typeCount: Record<string, number> = {}

  for (const card of expanded) {
    const n = norm(card.name)
    namesPresent.add(n)
    if (isGameChanger(n)) gcCount++
    if (MASS_LAND_DENIAL.has(n)) massLandCount++
    if (EXTRA_TURN.has(n)) extraTurnCount++
    if (FAST_MANA.has(n)) fastManaCount++
    if (isTutor(card)) tutorCount++

    const tl = card.type_line ?? ''
    const mt = tl ? mainType(tl) : 'Unknown'
    typeCount[mt] = (typeCount[mt] ?? 0) + 1
  }

  // Count only COMPLETE combo pairs (both halves present).
  let infiniteComboCount = 0
  for (const [a, b] of COMBO_PAIRS) {
    if (namesPresent.has(a) && namesPresent.has(b)) infiniteComboCount++
  }

  // ── Color % (approximate from commander identity) ─────────────────────────

  const colorPercent: Record<string, number> = {}
  if (colorIdentity.length > 0) {
    const ci = colorIdentity
    // Count mana symbol occurrences across oracle texts as a rough proxy
    const symbolCount: Record<string, number> = Object.fromEntries(ci.map((c) => [c, 0]))
    for (const card of expanded) {
      const text = card.oracle_text ?? ''
      for (const col of ci) {
        symbolCount[col] += (text.match(new RegExp(`\\{${col}\\}`, 'g')) ?? []).length
      }
    }
    const symbolTotal = Object.values(symbolCount).reduce((a, b) => a + b, 0) || ci.length
    for (const col of ci) {
      colorPercent[col] = Math.round(((symbolCount[col] || 1) / symbolTotal) * 100)
    }
  }

  // ── Bracket assignment ────────────────────────────────────────────────────

  let bracket: Bracket = 1

  // B2: tutors or fast mana present at any level
  if (tutorCount >= 1 || fastManaCount >= 1) bracket = 2

  // B3: 1–3 Game Changers
  if (gcCount >= 1 && gcCount <= 3) bracket = 3

  // B4: >3 GCs, mass-land-denial, multiple extra-turns, or heavy stax package
  if (
    gcCount > 3 ||
    massLandCount >= 1 ||
    extraTurnCount >= 2 ||
    infiniteComboCount >= 1 ||
    (tutorCount >= 6 && fastManaCount >= 3)
  ) bracket = 4

  // B5: cEDH signals
  if (
    (infiniteComboCount >= 1 && (tutorCount >= 2 || fastManaCount >= 2)) ||
    gcCount >= 10 ||
    (gcCount > 6 && tutorCount >= 8) ||
    (fastManaCount >= 5 && tutorCount >= 6)
  ) bracket = 5

  // ── U/L sub-rating ────────────────────────────────────────────────────────

  let subRating: SubRating = null
  if (bracket < 5) {
    const upper =
      (bracket === 1 && (fastManaCount >= 1 || tutorCount >= 1)) ||
      (bracket === 2 && (gcCount >= 1 || fastManaCount >= 3)) ||
      (bracket === 3 && (gcCount === 3 || extraTurnCount >= 1)) ||
      (bracket === 4 && (infiniteComboCount >= 1 || tutorCount >= 10))
    subRating = upper ? 'U' : 'L'
  }

  // ── Flags ─────────────────────────────────────────────────────────────────

  const flags: BracketFlags = {
    gameChangers: gcCount > 0,
    massLandDenial: massLandCount > 0,
    extraTurns: extraTurnCount > 0,
    tutorDensity: tutorCount >= 4,
    infiniteCombos: infiniteComboCount > 0,
    fastMana: fastManaCount >= 3,
  }

  // ── Upgrade suggestions ───────────────────────────────────────────────────

  const upgradeSuggestions = buildSuggestions(bracket, gcCount, tutorCount, fastManaCount)

  return {
    bracket,
    subRating,
    gameChangerCount: gcCount,
    massLandDenialCount: massLandCount,
    extraTurnCount,
    tutorCount,
    fastManaCount,
    infiniteComboCount,
    totalCards: total,
    colorPercent,
    typeCount,
    flags,
    upgradeSuggestions,
  }
}

function buildSuggestions(
  bracket: Bracket,
  gcCount: number,
  tutorCount: number,
  fastManaCount: number,
): UpgradeSuggestion[] {
  const s: UpgradeSuggestion[] = []

  if (bracket <= 2) {
    s.push({ name: 'Sol Ring', reason: 'Ubiquitous 1-mana rock -- fast mana, legal in every bracket.', raisesBracket: false })
    s.push({ name: 'Arcane Signet', reason: '2-drop color-fixer; plays well at any power level.', raisesBracket: false })
    s.push({ name: 'Command Tower', reason: 'Best fixing land in Commander.', raisesBracket: false })
  }

  if (bracket <= 3 && tutorCount < 2) {
    s.push({ name: 'Demonic Tutor', reason: 'Most efficient tutor in the format; Game Changer.', raisesBracket: true })
    s.push({ name: 'Vampiric Tutor', reason: 'Instant-speed tutor; Game Changer.', raisesBracket: true })
  }

  if (bracket <= 3 && fastManaCount < 2) {
    s.push({ name: 'Mana Vault', reason: 'High-output fast mana; Game Changer -- pushes toward B3.', raisesBracket: true })
  }

  if (bracket === 3 && gcCount < 3) {
    s.push({ name: 'Rhystic Study', reason: 'High-value draw engine; Game Changer.', raisesBracket: true })
  }

  return s
}

/**
 * Convenience: score a deck given only card names (no oracle text / type).
 * Used for quick bracket estimates when full card data is not loaded yet.
 */
export function scoreDeckByNames(names: string[]): BracketResult {
  return scoreDeck(names.map((name) => ({ name })))
}

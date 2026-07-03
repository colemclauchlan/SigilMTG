/**
 * Sigil — Official Commander "Game Changers" list
 *
 * Source: WotC Commander Brackets — official Game Changers list,
 * 53 cards as of the February 9, 2026 update (added Biorhythm, Farewell).
 * https://magic.wizards.com/en/commander-brackets
 *
 * IMPORTANT — what this list IS and IS NOT:
 *   The "Game Changers" list is its OWN curated bracket lever. It is SEPARATE
 *   from the other bracket signals — fast mana, mass-land-denial, extra-turn
 *   cards, tutor density, and 2-card infinite combos are tracked independently
 *   (see bracket.ts) and are NOT members of this list. Notably, Sol Ring is
 *   deliberately NOT a Game Changer, and banned cards (Mana Crypt, Jeweled
 *   Lotus, Dockside Extortionist, Nadu) are not here either — they are banned,
 *   not "changers".
 *
 * Bracket rules for Game Changers:
 *   - Banned in Bracket 1 (Exhibition) and Bracket 2 (Core)
 *   - Maximum 3 allowed in Bracket 3 (Upgraded)
 *   - Unrestricted in Bracket 4 (Optimized) and Bracket 5 (cEDH)
 *
 * Names are stored lowercase for case-insensitive matching.
 * Update this list as WotC publishes new Game Changers updates.
 */

export const GAME_CHANGERS: ReadonlySet<string> = new Set([
  "ad nauseam",
  "ancient tomb",
  "aura shards",
  "biorhythm",
  "bolas's citadel",
  "braids, cabal minion",
  "chrome mox",
  "coalition victory",
  "consecrated sphinx",
  "crop rotation",
  "cyclonic rift",
  "demonic tutor",
  "drannith magistrate",
  "enlightened tutor",
  "farewell",
  "field of the dead",
  "fierce guardianship",
  "force of will",
  "gaea's cradle",
  "gamble",
  "gifts ungiven",
  "glacial chasm",
  "grand arbiter augustin iv",
  "grim monolith",
  "humility",
  "imperial seal",
  "intuition",
  "jeska's will",
  "lion's eye diamond",
  "mana vault",
  "mishra's workshop",
  "mox diamond",
  "mystical tutor",
  "narset, parter of veils",
  "natural order",
  "necropotence",
  "notion thief",
  "opposition agent",
  "orcish bowmasters",
  "panoptic mirror",
  "rhystic study",
  "seedborn muse",
  "serra's sanctum",
  "smothering tithe",
  "survival of the fittest",
  "teferi's protection",
  "tergrid, god of fright",
  "thassa's oracle",
  "the one ring",
  "the tabernacle at pendrell vale",
  "underworld breach",
  "vampiric tutor",
  "worldly tutor",
])


/** Return true if a card name is on the Game Changers list. Case-insensitive. */
export function isGameChanger(cardName: string): boolean {
  return GAME_CHANGERS.has(cardName.toLowerCase().trim())
}

/**
 * Deck synergy + card-recommendation catalog (audit gap #3).
 * Ported verbatim from the vanilla deck-builder.js (cardRecommendationCatalog,
 * synergyMatchers, detectDeckThemes, recommendCardsForDeck).
 */
export interface RecCard {
  name: string
  role: string
  colors?: string[]
  tags: string[]
  bracketMax?: number
  bracketMin?: number
  why: string
}

export const CARD_RECOMMENDATIONS: RecCard[] = [
  { name: "Arcane Signet", role: "ramp", tags: ["any"], bracketMax: 4, why: "It fixes colors cheaply and helps your deck start doing its real thing a turn earlier." },
  { name: "Nature's Lore", role: "ramp", colors: ["G"], tags: ["green"], bracketMax: 4, why: "It finds typed Forest duals untapped, which smooths colors without costing tempo." },
  { name: "Fellwar Stone", role: "ramp", tags: ["any"], bracketMax: 4, why: "At multiplayer tables it usually taps for useful colors and keeps two-mana ramp density healthy." },
  { name: "Swords to Plowshares", role: "interaction", colors: ["W"], tags: ["white"], bracketMax: 4, why: "It answers almost any creature for one mana, protecting your game plan without eating a whole turn." },
  { name: "Beast Within", role: "interaction", colors: ["G"], tags: ["green"], bracketMax: 4, why: "It hits creatures, combo pieces, lands, and problem permanents, which gives the deck flexible table coverage." },
  { name: "Pongify", role: "interaction", colors: ["U"], tags: ["blue"], bracketMax: 4, why: "It gives blue decks a clean one-mana answer to creature-based engines and commanders." },
  { name: "Village Rites", role: "draw", colors: ["B"], tags: ["sacrifice", "aristocrats"], bracketMax: 3, why: "It turns expendable creatures into cards, which is perfect when your deck already wants bodies to die." },
  { name: "Skullclamp", role: "draw", tags: ["tokens", "sacrifice", "creatures"], bracketMax: 4, why: "Your small creatures become a repeatable draw engine, especially if the deck is making tokens." },
  { name: "Guardian Project", role: "draw", colors: ["G"], tags: ["creatures"], bracketMax: 3, why: "Creature-heavy lists need steady refill, and this rewards you for simply casting your threats." },
  { name: "Archmage Emeritus", role: "draw", colors: ["U"], tags: ["spellslinger", "storm"], bracketMax: 3, why: "Every instant and sorcery starts replacing itself, which keeps spell chains from running dry." },
  { name: "Storm-Kiln Artist", role: "ramp", colors: ["R"], tags: ["spellslinger", "storm"], bracketMax: 3, why: "It turns each spell into mana, helping the deck chain big turns while still attacking if needed." },
  { name: "Young Pyromancer", role: "engine", colors: ["R"], tags: ["spellslinger", "tokens"], bracketMax: 3, why: "It converts normal spellcasting into board presence, giving your noncreature plan a creature payoff." },
  { name: "Anointed Procession", role: "engine", colors: ["W"], tags: ["tokens"], bracketMax: 3, why: "If your deck already makes tokens, doubling that output makes every token maker scale dramatically harder." },
  { name: "Aura Shards", role: "interaction", colors: ["G", "W"], tags: ["tokens", "creatures"], bracketMax: 3, why: "Creature and token production becomes repeatable artifact/enchantment removal, which is excellent board control." },
  { name: "Hardened Scales", role: "engine", colors: ["G"], tags: ["counters"], bracketMax: 3, why: "It makes every +1/+1 counter effect more efficient, increasing pressure without needing extra cards." },
  { name: "Kami of Whispered Hopes", role: "ramp", colors: ["G"], tags: ["counters"], bracketMax: 3, why: "It both increases counter placement and turns your board growth into mana for larger follow-up plays." },
  { name: "Foundry Inspector", role: "ramp", tags: ["artifacts"], bracketMax: 3, why: "Artifact decks love cost reduction because it lets several cheap pieces land in the same turn." },
  { name: "Thought Monitor", role: "draw", colors: ["U"], tags: ["artifacts"], bracketMax: 3, why: "Affinity turns your artifact count into cheap card draw on a relevant body." },
  { name: "Victimize", role: "recursion", colors: ["B"], tags: ["graveyard", "sacrifice"], bracketMax: 3, why: "It converts one creature into two better creatures from the graveyard, which is a huge tempo swing." },
  { name: "Eternal Witness", role: "recursion", colors: ["G"], tags: ["graveyard", "value"], bracketMax: 3, why: "It rebuying your best spell gives the deck resilience after removal or a failed push." },
  { name: "Sythis, Harvest's Hand", role: "draw", colors: ["G", "W"], tags: ["enchantments"], bracketMax: 3, why: "Enchantress decks need draw tied to enchantment casting, and Sythis makes every setup piece replace itself." },
  { name: "Sram, Senior Edificer", role: "draw", colors: ["W"], tags: ["equipment", "auras"], bracketMax: 3, why: "Equipment and Aura decks can run out of gas; Sram turns those setup cards into a steady hand." },
  { name: "Well of Lost Dreams", role: "draw", tags: ["lifegain"], bracketMax: 3, why: "If you are already gaining life, this converts that life gain into real card advantage." },
  { name: "Vito, Thorn of the Dusk Rose", role: "finisher", colors: ["B"], tags: ["lifegain"], bracketMax: 3, why: "It turns life gain into opponent life loss, giving the deck a cleaner way to close games." },
  { name: "Mystic Remora", role: "draw", colors: ["U"], tags: ["optimized"], bracketMin: 4, why: "At stronger tables, it taxes fast noncreature starts and draws enough cards to keep pace." },
  { name: "Fierce Guardianship", role: "interaction", colors: ["U"], tags: ["optimized"], bracketMin: 4, why: "Free protection lets your commander or combo turn survive without holding mana open." },
]

export const SYNERGY_MATCHERS: { label: string; terms: string[] }[] = [
  { label: 'Counters', terms: ['counter', 'proliferate', '+1/+1'] },
  { label: 'Tokens', terms: ['token', 'create'] },
  { label: 'Artifacts', terms: ['artifact', 'treasure', 'clue', 'food'] },
  { label: 'Enchantments', terms: ['enchantment', 'aura', 'saga'] },
  { label: 'Graveyard', terms: ['graveyard', 'mill', 'return target', 'reanimate'] },
  { label: 'Sacrifice', terms: ['sacrifice', 'dies'] },
  { label: 'Lifegain', terms: ['gain life', 'lifelink'] },
  { label: 'Card draw', terms: ['draw a card', 'draw two', 'draw x'] },
  { label: 'Spellslinger', terms: ['instant', 'sorcery', 'copy target'] },
  { label: 'Equipment', terms: ['equipment', 'equip'] },
  { label: 'Poison', terms: ['poison', 'toxic', 'infect'] },
  { label: 'Combat', terms: ['attack', 'combat damage', 'double strike'] },
]

const THEME_CHECKS: [string, string[]][] = [
  ['tokens', ['token', 'create a', 'populate']],
  ['spellslinger', ['instant', 'sorcery', 'magecraft', 'copy target instant', 'copy target sorcery']],
  ['storm', ['storm', 'copy target instant', 'copy target sorcery']],
  ['counters', ['+1/+1 counter', 'proliferate', 'counter on']],
  ['artifacts', ['artifact', 'treasure', 'equipment']],
  ['graveyard', ['graveyard', 'reanimate', 'return target creature card', 'escape']],
  ['sacrifice', ['sacrifice', 'dies', 'whenever a creature dies']],
  ['lifegain', ['gain life', 'lifelink', 'whenever you gain life']],
  ['enchantments', ['enchantment', 'aura', 'constellation']],
  ['equipment', ['equipment', 'equip', 'aura']],
  ['creatures', ['creature', 'enters the battlefield']],
]

/** Detect deck themes from concatenated deck text. */
export function detectThemes(deckText: string): string[] {
  const t = deckText.toLowerCase()
  // Word-boundary match for plain words (so 'storm' doesn't hit 'brainstorm'); substring for terms with symbols.
  const hit = (w: string) => {
    if (!/^[a-z ]+$/.test(w)) return t.includes(w)
    // Match only at a word START (rejects 'storm' inside 'brainstorm') but allow a
    // trailing suffix so plurals/inflections still hit ('token' matches 'tokens').
    for (let i = t.indexOf(w); i !== -1; i = t.indexOf(w, i + 1)) {
      const before = i === 0 ? '' : t[i - 1]
      if (!/[a-z0-9]/.test(before)) return true
    }
    return false
  }
  return THEME_CHECKS.filter(([, words]) => words.some(hit)).map(([theme]) => theme)
}

/** Synergy labels for a single card given the deck context. */
export function getSynergyLabels(cardText: string, deckText: string): string[] {
  const text = cardText.toLowerCase()
  const dtext = deckText.toLowerCase()
  const labels = new Set<string>()
  for (const m of SYNERGY_MATCHERS) {
    const cardHit = m.terms.some((term) => text.includes(term))
    const deckHit = m.terms.some((term) => dtext.includes(term))
    if (cardHit || (deckHit && text.includes(m.label.toLowerCase()))) labels.add(m.label)
  }
  return [...labels].slice(0, 8)
}

function fitsColors(card: RecCard, colors: Set<string>): boolean {
  if (!card.colors?.length) return true
  return card.colors.every((c) => colors.has(c))
}

export interface RecInput {
  names: Set<string>
  colors: Set<string>
  themes: string[]
  ramp: number
  draw: number
  interaction: number
  bracket: number
}

/** Recommend cards to add, scored by missing roles + theme tags + color/bracket fit. */
export function recommendCards(input: RecInput, limit = 6): RecCard[] {
  const themes = new Set(input.themes)
  const missing: string[] = []
  if (input.ramp < 8) missing.push('ramp')
  if (input.draw < 8) missing.push('draw')
  if (input.interaction < 8) missing.push('interaction')
  return CARD_RECOMMENDATIONS
    .filter((c) => !input.names.has(c.name.toLowerCase()))
    .filter((c) => fitsColors(c, input.colors))
    .filter((c) => !c.bracketMin || input.bracket >= c.bracketMin)
    .filter((c) => !c.bracketMax || input.bracket <= c.bracketMax)
    .map((c) => {
      let score = 0
      if (missing.includes(c.role)) score += 5
      if (c.tags?.some((t) => themes.has(t))) score += 4
      if (c.tags?.includes('any')) score += 1
      return { c, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c)
}

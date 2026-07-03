import { describe, it, expect } from 'vitest'
import { ALL_PRECONS } from '../index'

const BASICS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'])

function cardLines(decklist: string): string[] {
  return decklist
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
}

function countCards(decklist: string): number {
  let total = 0
  for (const line of cardLines(decklist)) {
    const m = line.match(/^(\d+)\s+/)
    total += m ? parseInt(m[1], 10) : 1
  }
  return total
}

describe('PreCon data integrity (Agent B audit guard)', () => {
  it('ships at least the 6 seed decks', () => {
    expect(ALL_PRECONS.length).toBeGreaterThanOrEqual(6)
  })

  for (const deck of ALL_PRECONS) {
    it(`${deck.id} is a legal 100-card Commander deck`, () => {
      expect(countCards(deck.decklist)).toBe(100)
    })

    it(`${deck.id} lists its commander`, () => {
      expect(deck.decklist.toLowerCase()).toContain(deck.commanderName.toLowerCase())
    })

    it(`${deck.id} keeps non-basics singleton`, () => {
      const names = cardLines(deck.decklist)
        .map((l) => l.replace(/^\d+\s+/, ''))
        .filter((n) => !BASICS.has(n))
      const seen = new Set<string>()
      const dupes = names.filter((n) => (seen.has(n) ? true : (seen.add(n), false)))
      expect(dupes).toEqual([])
    })
  }
})

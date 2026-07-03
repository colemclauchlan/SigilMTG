/**
 * MockGameLoader — loads a Krenko Goblins sample deck into the Zustand store on mount.
 * Calls window.MTGCore.init, draws 7, then fetches Scryfall images.
 *
 * When `disabled` is true (online/server mode), this component is a no-op —
 * the server snapshot drives the store instead of the local mock.
 */
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import type { CardMeta } from '../../store/gameStore'
import type { GameState } from '../../types/game'

interface DeckCard {
  cardId: string
  name: string
  isCommander?: boolean
  zone?: string
}

const SAMPLE_DECK: DeckCard[] = [
  { cardId: 'krenko-mob-boss', name: 'Krenko, Mob Boss', isCommander: true },
  { cardId: 'goblin-chieftain', name: 'Goblin Chieftain' },
  { cardId: 'sol-ring', name: 'Sol Ring' },
  { cardId: 'lightning-bolt', name: 'Lightning Bolt' },
  { cardId: 'goblin-bombardment', name: 'Goblin Bombardment' },
  { cardId: 'skirk-prospector', name: 'Skirk Prospector' },
  { cardId: 'impact-tremors', name: 'Impact Tremors' },
  { cardId: 'krenkos-command', name: "Krenko's Command" },
  { cardId: 'goblin-matron', name: 'Goblin Matron' },
  { cardId: 'shatterskull-smashing', name: 'Shatterskull Smashing' },
  { cardId: 'mountain-1', name: 'Mountain' },
  { cardId: 'mountain-2', name: 'Mountain' },
  { cardId: 'mountain-3', name: 'Mountain' },
  { cardId: 'mountain-4', name: 'Mountain' },
  { cardId: 'mountain-5', name: 'Mountain' },
  { cardId: 'mountain-6', name: 'Mountain' },
  { cardId: 'mountain-7', name: 'Mountain' },
  { cardId: 'mountain-8', name: 'Mountain' },
  { cardId: 'mountain-9', name: 'Mountain' },
  { cardId: 'mountain-10', name: 'Mountain' },
  { cardId: 'mountain-11', name: 'Mountain' },
  { cardId: 'mountain-12', name: 'Mountain' },
]

// Unique card names to fetch from Scryfall
const UNIQUE_NAMES = [
  'Krenko, Mob Boss',
  'Goblin Chieftain',
  'Sol Ring',
  'Lightning Bolt',
  'Goblin Bombardment',
  'Skirk Prospector',
  'Impact Tremors',
  "Krenko's Command",
  'Goblin Matron',
  'Shatterskull Smashing',
  'Mountain',
]

async function fetchScryfallImages(names: string[]): Promise<Record<string, CardMeta>> {
  const result: Record<string, CardMeta> = {}
  for (let _b = 0; _b < names.length; _b += 75) {
    const identifiers = names.slice(_b, _b + 75).map((name) => ({ name }))
    try {
    const resp = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    })
    if (!resp.ok) continue
    const json = await resp.json() as { data?: Array<{
      id: string; name: string; type_line?: string; power?: string | null;
      toughness?: string | null; cmc?: number; colors?: string[]; keywords?: string[];
      image_uris?: { normal?: string; large?: string };
      card_faces?: Array<{ image_uris?: { normal?: string; large?: string } }>
    }> }
    for (const card of json.data ?? []) {
      // resolve image
      let img = card.image_uris?.normal ?? card.image_uris?.large ?? ''
      let back: string | undefined
      if (!img && card.card_faces) {
        img = card.card_faces[0]?.image_uris?.normal ?? card.card_faces[0]?.image_uris?.large ?? ''
        back = card.card_faces[1]?.image_uris?.normal ?? card.card_faces[1]?.image_uris?.large
      }
      const isPT = (card.type_line ?? '').toLowerCase().includes('creature')
      result[card.name] = {
        img,
        back,
        name: card.name,
        pt: isPT && card.power != null && card.toughness != null
          ? [card.power, card.toughness]
          : null,
        isCreature: isPT,
        cmc: card.cmc,
        colors: card.colors,
        type: card.type_line,
        keywords: card.keywords,
        scryfallId: card.id,
      }
    }
  } catch {
    // network failure — images won't load but game still works
  }
  }
  return result
}

export default function MockGameLoader({ disabled = false }: { disabled?: boolean }) {
  const setGameState = useGameStore((s) => s.setGameState)
  const pushImageMeta = useGameStore((s) => s.pushImageMeta)
  const setMySeat = useGameStore((s) => s.setMySeat)
  const pendingDeck = useGameStore((s) => s.pendingDeck)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const didInit = useRef(false)

  useEffect(() => {
    if (disabled) return  // online mode — server drives state, no mock needed
    if (didInit.current) return
    didInit.current = true

    async function init() {
      try {
        if (!window.MTGCore) {
          throw new Error('window.MTGCore not loaded — is table-core.js in index.html?')
        }

        // Build deck entries from the chosen deck (or the Krenko sample).
        const decksEntry: { cardId: string; name: string; isCommander: boolean; zone: string }[] = []
        if (pendingDeck && pendingDeck.cards.length) {
          pendingDeck.cards.forEach((c, ci) => {
            const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            for (let i = 0; i < Math.max(1, c.qty); i++) {
              const cmd = !!c.isCommander && i === 0
              decksEntry.push({ cardId: slug + '-' + ci + '-' + i, name: c.name, isCommander: cmd, zone: cmd ? 'command' : 'library' })
            }
          })
        } else {
          for (const c of SAMPLE_DECK) decksEntry.push({ cardId: c.cardId, name: c.name, isCommander: c.isCommander ?? false, zone: c.isCommander ? 'command' : 'library' })
        }
        const uniqueNames = [...new Set(decksEntry.map((e) => e.name))]

        const rawState = window.MTGCore.init({
          seats: 1,
          deckSize: 0,
          decks: [decksEntry],
        })

        // Shuffle library, then draw 7
        let state = rawState as Record<string, unknown>

        // shuffle
        state = window.MTGCore.reduce(state, { t: 'library_shuffle', seat: 0 })

        // draw 7
        state = window.MTGCore.reduce(state, { t: 'draw', seat: 0, count: 7 })

        setGameState(state as unknown as GameState)
        setMySeat(0)
        useGameStore.getState().setUI({ openingHandOpen: true })
        setLoading(false) // board + opening-hand render now; images stream in below

        // Fetch images async (non-blocking for the board)
        const imageMeta = await fetchScryfallImages(uniqueNames)

        // Build a map from cardId → meta (by card name)
        const byCardId: Record<string, CardMeta> = {}
        for (const e of decksEntry) {
          if (imageMeta[e.name]) byCardId[e.cardId] = imageMeta[e.name]
        }
        pushImageMeta(byCardId)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [setGameState, pushImageMeta, setMySeat, pendingDeck])

  if (disabled) return null

  if (error) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(7,13,26,0.92)',
          color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: 14,
        }}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Game load error</p>
          <pre style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', maxWidth: 480 }}>{error}</pre>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--navy)', flexDirection: 'column', gap: 16,
        }}
      >
        {/* spinner */}
        <div
          style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid var(--ink-3)',
            borderTopColor: 'var(--brand)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
          Loading game…
        </p>
      </div>
    )
  }

  return null
}

/**
 * TokenModal — create tokens on the battlefield (audit gap #5).
 * Scryfall is:token search + quantity + quick-token shortcuts -> token_create.
 */
import { useState, useEffect } from 'react'
import { X, Search, Plus, Minus } from 'lucide-react'
import { searchCards, getCardImage, type ResolvedCard } from '../../lib/scryfall'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

let tokenSeq = 1
const QUICK = ['Treasure', 'Soldier', 'Zombie', 'Goblin', 'Saproling', 'Spirit', 'Clue', 'Food', 'Blood', 'Angel', 'Beast', 'Elemental']

export default function TokenModal({ open, onClose, seat }: { open: boolean; onClose: () => void; seat: number }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResolvedCard[]>([])
  const [searching, setSearching] = useState(false)
  const [qty, setQty] = useState(1)
  const [tokensOnly, setTokensOnly] = useState(true)
  const [added, setAdded] = useState(0)
  const pushImageMeta = useGameStore((s) => s.pushImageMeta)
  const { dispatch } = useGameEngine()

  // Live debounced search-as-you-type.
  useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (!tokensOnly && !term) { setResults([]); return }
    const h = setTimeout(() => { void run(term) }, 350)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tokensOnly, open])

  useEffect(() => { if (!open) { setAdded(0); setResults([]); setQuery('') } }, [open])

  if (!open) return null

  async function run(term: string) {
    setSearching(true)
    try {
      const q = (tokensOnly ? `is:token ${term}` : term).trim()
      const r = await searchCards(q, { limit: 30 })
      setResults(r)
    } catch { setResults([]) } finally { setSearching(false) }
  }

  function spawn(card: ResolvedCard) {
    for (let i = 0; i < qty; i++) {
      const id = `tok-${tokenSeq++}-${Math.floor(Math.random() * 1e6)}`
      const isCreature = /creature/i.test(card.type_line)
      const pt: [string, string] | null = (card.power != null && card.toughness != null) ? [card.power, card.toughness] : null
      pushImageMeta({ [id]: { img: getCardImage(card, 'normal') || '', name: card.name, isCreature, pt, type: card.type_line } })
      dispatch({ t: 'token_create', instanceId: id, cardId: id, ownerSeat: seat, name: card.name, x: 32 + Math.random() * 18 + (i % 5) * 2, y: 50 + Math.random() * 10 } as never)
    }
    setAdded((n) => n + qty) // stay open for multi-add
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" style={{ background: 'rgba(2,6,14,0.72)' }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: 'var(--panel-strong)', border: '1px solid var(--hairline)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--hairline)' }}>
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--paper)' }}>Create token{added > 0 ? ` · ${added} added` : ''}</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setTokensOnly((v) => !v)} className="text-xs font-semibold px-2 h-7 rounded-md" style={{ border: '1px solid var(--hairline)', background: tokensOnly ? 'var(--brand-soft)' : 'transparent', color: tokensOnly ? 'var(--brand-bright)' : 'var(--muted)' }} title="Toggle searching all cards vs tokens only">{tokensOnly ? 'Tokens only' : 'All cards'}</button>
            <button onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <form onSubmit={(e) => { e.preventDefault(); run(query) }} className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md px-2 h-9 flex-1" style={{ border: '1px solid var(--hairline)' }}>
              <Search size={15} style={{ color: 'var(--muted)' }} />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Token name (e.g. Soldier, Treasure)…" className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--paper)' }} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Qty</span>
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded grid place-items-center" style={{ border: '1px solid var(--hairline)' }}><Minus size={12} /></button>
              <span className="w-6 text-center tabular-nums font-semibold">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className="w-7 h-7 rounded grid place-items-center" style={{ border: '1px solid var(--hairline)' }}><Plus size={12} /></button>
            </div>
            <button type="submit" className="px-3 h-9 rounded-md text-sm font-semibold" style={{ background: 'var(--accent)', color: '#04101f' }}>{searching ? '…' : 'Search'}</button>
          </form>

          <div className="flex flex-wrap gap-1">
            {QUICK.map((t) => (
              <button key={t} onClick={() => setQuery(t)} className="px-2 h-7 rounded-md text-xs font-semibold" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>{t}</button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4 overflow-y-auto">
          {results.length === 0 && !searching && <div className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Search for a token to create (×{qty}).</div>}
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
            {results.map((card) => (
              <button key={card.id} onClick={() => spawn(card)} className="group relative rounded-lg overflow-hidden text-left transition-transform hover:scale-[1.06] hover:z-10" style={{ border: '1px solid var(--hairline)', aspectRatio: '63 / 88' }} title={`Create ${qty}x ${card.name}`}>
                {getCardImage(card, 'normal') ? <img src={getCardImage(card, 'normal')} alt={card.name} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center text-xs p-2 text-center" style={{ background: 'var(--ink-2)' }}>{card.name}</div>}
                <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition text-sm font-bold" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>+{qty}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Interactive Deck Builder — full vanilla parity port (Agent B, #86 + audit gaps).
 * Search (format/color-id/sort) + autocomplete -> add/qty/section/maybeboard ->
 * grouped-by-type list w/ in-deck filter, Game-Changer badges, flash-on-add,
 * card preview -> stats (curve, color ratio, types), bracket review (ramp/draw/
 * interaction + GC/tutor/fast-mana/combo narrative), deck warnings, draw-hand,
 * notes, format selector -> save/load.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Plus, Minus, Trash2, Save, Loader2, X, Hand, AlertTriangle, Star } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { searchCards, autocompleteCardName, getCardByName, getCardImage, type ResolvedCard } from '../lib/scryfall'
import { saveDeck, saveDeckCards, loadDeck, type DeckCardEntry, type DeckSection } from '../lib/decks'
import { scoreDeck, type DeckCard } from '../lib/bracket'
import { isGameChanger } from '../data/gameChangers'
import { detectThemes, recommendCards } from '../data/synergy'

const SECTIONS: { key: DeckSection; label: string }[] = [
  { key: 'commander', label: 'Commander' },
  { key: 'mainboard', label: 'Mainboard' },
  { key: 'sideboard', label: 'Sideboard' },
  { key: 'maybeboard', label: 'Maybe' },
]
const TYPE_ORDER = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle', 'Land', 'Other']
const COLOR_TOKENS: Record<string, string> = { W: 'var(--mana-w)', U: 'var(--mana-u)', B: 'var(--mana-b)', R: 'var(--mana-r)', G: 'var(--mana-g)', C: 'var(--muted)' }
const FORMATS = ['commander', 'standard', 'modern', 'pioneer', 'legacy', 'vintage', 'pauper', 'historic']
const SORTS: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' }, { key: 'cmc', label: 'Mana value' }, { key: 'color', label: 'Color' },
  { key: 'rarity', label: 'Rarity' }, { key: 'released', label: 'Released' }, { key: 'edhrec', label: 'EDHREC' },
]
const BASICS = new Set(['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes', 'snow-covered plains', 'snow-covered island', 'snow-covered swamp', 'snow-covered mountain', 'snow-covered forest'])

function entryKey(name: string, section: DeckSection) { return section + '::' + name.toLowerCase() }
function mainType(tl: string): string { if (tl.includes('Land')) return 'Land'; for (const t of TYPE_ORDER) if (t !== 'Other' && tl.includes(t)) return t; return 'Other' }
function isBasic(name: string) { return BASICS.has(name.toLowerCase()) }

export default function DeckBuilder() {
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [editId, setEditId] = useState<string | undefined>(undefined)

  const [deckName, setDeckName] = useState('Untitled Deck')
  const [format, setFormat] = useState('commander')
  const [notes, setNotes] = useState('')
  const [query, setQuery] = useState('')
  const [colorId, setColorId] = useState('')
  const [sort, setSort] = useState('name')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [results, setResults] = useState<ResolvedCard[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const [addSection, setAddSection] = useState<DeckSection>('mainboard')
  const [cards, setCards] = useState<DeckCardEntry[]>([])
  const [deckFilter, setDeckFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [flashKey, setFlashKey] = useState('')
  const [preview, setPreview] = useState<ResolvedCard | null>(null)
  const [drawOpen, setDrawOpen] = useState(false)
  const [hand, setHand] = useState<string[]>([])
  const reqId = useRef(0)
  const acId = useRef(0)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setSuggestions([]); return }
    const id = ++acId.current
    const t = setTimeout(async () => {
      try { const s = await autocompleteCardName(q); if (id === acId.current) setSuggestions(s.slice(0, 8)) }
      catch { if (id === acId.current) setSuggestions([]) }
    }, 220)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const id = params.get('deck')
    if (!id) return
    let live = true
    loadDeck(id, userId).then((d) => {
      if (!live || !d) return
      setEditId(d.id); setDeckName(d.name); setFormat(d.format || 'commander'); setNotes(d.notes || '')
      if (d.cards) setCards(d.cards)
    }).catch(() => {})
    return () => { live = false }
  }, [params, userId])

  const runSearch = useCallback(async (raw: string) => {
    let q = raw.trim()
    if (!q && !colorId.trim()) return
    if (format) q += ` f:${format}`
    if (colorId.trim()) q += ` id:${colorId.trim().toLowerCase()}`
    const id = ++reqId.current
    setSearching(true); setSearchErr(''); setSuggestions([])
    try { const r = await searchCards(q.trim(), { limit: 60, order: sort }); if (id === reqId.current) setResults(r) }
    catch (e) { if (id === reqId.current) { setResults([]); setSearchErr((e as Error).message || 'Search failed') } }
    finally { if (id === reqId.current) setSearching(false) }
  }, [format, colorId, sort])

  const flash = useCallback((k: string) => {
    setFlashKey(k)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashKey(''), 900)
  }, [])

  const addCard = useCallback((card: ResolvedCard, section: DeckSection) => {
    setSavedMsg('')
    const k = entryKey(card.name, section)
    setCards((cs) => {
      const idx = cs.findIndex((c) => entryKey(c.cardName, c.section) === k)
      if (idx >= 0) { const n = [...cs]; n[idx] = { ...n[idx], quantity: n[idx].quantity + 1 }; return n }
      return [...cs, { cardName: card.name, quantity: 1, section, scryfallId: card.id, foil: false, cardSnapshot: { ...card } }]
    })
    flash(k)
  }, [flash])
  async function addByName(name: string) {
    try { const c = await getCardByName(name); addCard(c, addSection); setQuery(''); setSuggestions([]) } catch {}
  }
  const changeQty = useCallback((k: string, d: number) => {
    setCards((cs) => cs.flatMap((c) => { if (entryKey(c.cardName, c.section) !== k) return [c]; const q = c.quantity + d; return q <= 0 ? [] : [{ ...c, quantity: q }] }))
  }, [])
  const moveSection = useCallback((k: string, to: DeckSection) => {
    setCards((cs) => {
      const e = cs.find((c) => entryKey(c.cardName, c.section) === k)
      if (!e) return cs
      const rest = cs.filter((c) => entryKey(c.cardName, c.section) !== k)
      const tk = entryKey(e.cardName, to)
      const existing = rest.findIndex((c) => entryKey(c.cardName, c.section) === tk)
      if (existing >= 0) { const n = [...rest]; n[existing] = { ...n[existing], quantity: n[existing].quantity + e.quantity }; return n }
      return [...rest, { ...e, section: to }]
    })
  }, [])
  const removeCard = useCallback((k: string) => setCards((cs) => cs.filter((c) => entryKey(c.cardName, c.section) !== k)), [])

  const inDeck = (c: DeckCardEntry) => c.section === 'commander' || c.section === 'mainboard'
  const totalCount = cards.reduce((n, c) => (inDeck(c) ? n + c.quantity : n), 0)
  const hasCommander = useMemo(() => cards.some((c) => c.section === 'commander'), [cards])
  const commanderCI = useMemo(() => {
    const ci = new Set<string>()
    for (const c of cards) if (c.section === 'commander') for (const col of ((c.cardSnapshot?.color_identity ?? []) as string[])) ci.add(col)
    return ci.size ? [...ci] : null
  }, [cards])

  const bracket = useMemo(() => {
    if (cards.length === 0) return null
    const dc: DeckCard[] = cards.filter((c) => c.section === 'commander' || c.section === 'mainboard').map((c) => ({ name: c.cardName, type_line: c.cardSnapshot?.type_line, oracle_text: c.cardSnapshot?.oracle_text, cmc: c.cardSnapshot?.cmc, quantity: c.quantity }))
    return scoreDeck(dc, commanderCI ?? [])
  }, [cards, commanderCI])

  const stats = useMemo(() => {
    const curve = [0, 0, 0, 0, 0, 0, 0, 0]
    const types: Record<string, number> = {}
    const colors: Record<string, number> = {}
    const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
    const landProd: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
    let cmcSum = 0, nonLand = 0, ramp = 0, draw = 0, interaction = 0
    for (const c of cards) {
      if (c.section !== 'commander' && c.section !== 'mainboard') continue
      const snap = c.cardSnapshot
      const tl = snap?.type_line ?? ''
      const isLand = /\bLand\b/.test(tl)
      const text = `${snap?.oracle_text ?? ''} ${tl}`.toLowerCase()
      types[mainType(tl)] = (types[mainType(tl)] ?? 0) + c.quantity
      for (const col of (snap?.color_identity ?? []) as string[]) colors[col] = (colors[col] ?? 0) + c.quantity
      if (isLand) {
        if (/plains|\{w\}/.test(text)) landProd.W += c.quantity
        if (/island|\{u\}/.test(text)) landProd.U += c.quantity
        if (/swamp|\{b\}/.test(text)) landProd.B += c.quantity
        if (/mountain|\{r\}/.test(text)) landProd.R += c.quantity
        if (/forest|\{g\}/.test(text)) landProd.G += c.quantity
      } else {
        const cmc = Math.max(0, Math.floor(snap?.cmc ?? 0))
        curve[Math.min(7, cmc)] += c.quantity
        cmcSum += (snap?.cmc ?? 0) * c.quantity; nonLand += c.quantity
        const mc = (snap?.mana_cost ?? '') as string
        for (const col of ['W', 'U', 'B', 'R', 'G', 'C']) { const m = mc.match(new RegExp('\\{' + col + '\\}', 'g')); if (m) pips[col] += m.length * c.quantity }
        if (/add \{|create a treasure/.test(text)) ramp += c.quantity
        if (/draw (a|one|two|three|\w+|that many) cards?/.test(text)) draw += c.quantity
        if (/(destroy|exile) (target|all|each)|counter target|deals? \d+ damage to|return target .* to (its|their)/.test(text)) interaction += c.quantity
      }
      if (isLand && /search your library for (a|up to)/.test(text)) ramp += c.quantity
    }
    return { curve, types, colors, pips, landProd, avgCmc: nonLand ? cmcSum / nonLand : 0, ramp, draw, interaction }
  }, [cards])

  const warnings = useMemo(() => {
    if (format !== 'commander' || cards.length === 0) return []
    const w: string[] = []
    if (totalCount !== 100) w.push(`Commander decks must be exactly 100 cards (currently ${totalCount}).`)
    if (!cards.some((c) => c.section === 'commander')) w.push('No commander assigned.')
    const dupes = cards.filter((c) => c.section === 'mainboard' && c.quantity > 1 && !isBasic(c.cardName))
    if (dupes.length) w.push(`Singleton: ${dupes.slice(0, 4).map((c) => c.cardName).join(', ')}${dupes.length > 4 ? '…' : ''}`)
    if (hasCommander) {
      const ci = commanderCI ?? []
      const off = cards.filter((c) => c.section === 'mainboard' && ((c.cardSnapshot?.color_identity ?? []) as string[]).some((col) => !ci.includes(col)))
      if (off.length) w.push(`${off.length} card(s) outside commander color identity.`)
    }
    return w
  }, [format, cards, totalCount, commanderCI, hasCommander])

  const recommendations = useMemo(() => {
    if (cards.length < 5) return []
    const deckText = cards.map((c) => `${c.cardName} ${c.cardSnapshot?.type_line ?? ''} ${c.cardSnapshot?.oracle_text ?? ''}`).join(' ')
    const themes = detectThemes(deckText)
    const names = new Set(cards.map((c) => c.cardName.toLowerCase()))
    const colors = new Set<string>((commanderCI && commanderCI.length ? commanderCI : Object.keys(stats.colors)))
    return recommendCards({ names, colors, themes, ramp: stats.ramp, draw: stats.draw, interaction: stats.interaction, bracket: bracket?.bracket ?? 3 })
  }, [cards, commanderCI, stats, bracket])

  function drawHand() {
    const pool: string[] = []
    for (const c of cards) if (c.section === 'mainboard') for (let i = 0; i < c.quantity; i++) pool.push(c.cardName)
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]] }
    setHand(pool.slice(0, 7)); setDrawOpen(true)
  }

  async function handleSave() {
    if (cards.length === 0) return
    setSaving(true); setSavedMsg('')
    try {
      const cmd = cards.find((c) => c.section === 'commander')
      const deck = await saveDeck({ ...(editId ? { id: editId } : {}), name: deckName.trim() || 'Untitled Deck', format, commanderName: cmd?.cardName, commanderScryfallId: cmd?.scryfallId, bracket: bracket?.bracket, notes, cards }, userId)
      await saveDeckCards(deck.id, cards, userId)
      setSavedMsg('Saved ✓'); setTimeout(() => navigate('/decks?deck=' + deck.id), 700)
    } catch (e) { setSavedMsg('Save failed: ' + ((e as Error).message || 'unknown')) }
    finally { setSaving(false) }
  }

  const filterLc = deckFilter.trim().toLowerCase()
  const grouped = SECTIONS.map((s) => {
    let items = cards.filter((c) => c.section === s.key)
    if (filterLc) items = items.filter((c) => c.cardName.toLowerCase().includes(filterLc) || (c.cardSnapshot?.type_line ?? '').toLowerCase().includes(filterLc))
    return { ...s, items, count: cards.filter((c) => c.section === s.key).reduce((n, c) => n + c.quantity, 0) }
  })
  const maxCurve = Math.max(1, ...stats.curve)
  const totalPips = Object.values(stats.pips).reduce((a, b) => a + b, 0) || 1

  // group mainboard items by card type
  function byType(items: DeckCardEntry[]) {
    const m: Record<string, DeckCardEntry[]> = {}
    for (const c of items) { const t = mainType(c.cardSnapshot?.type_line ?? ''); (m[t] ??= []).push(c) }
    return TYPE_ORDER.filter((t) => m[t]?.length).map((t) => ({ type: t, items: m[t] }))
  }

  const sectionSelect = (c: DeckCardEntry, k: string) => (
    <select value={c.section} onChange={(e) => moveSection(k, e.target.value as DeckSection)} className="text-[10px] rounded bg-transparent" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }} title="Move to section" onClick={(e) => e.stopPropagation()}>
      {SECTIONS.map((s) => <option key={s.key} value={s.key} style={{ color: '#000' }}>{s.label}</option>)}
    </select>
  )

  function row(c: DeckCardEntry) {
    const k = entryKey(c.cardName, c.section)
    const gc = isGameChanger(c.cardName)
    return (
      <div key={k} className="flex items-center gap-2 text-sm rounded px-1" style={{ background: flashKey === k ? 'var(--brand-soft)' : 'transparent', transition: 'background 0.4s' }}>
        <button onClick={() => changeQty(k, -1)} className="w-6 h-6 rounded grid place-items-center flex-shrink-0" style={{ border: '1px solid var(--hairline)' }} aria-label="Decrease"><Minus size={12} /></button>
        <span className="w-5 text-center tabular-nums font-semibold">{c.quantity}</span>
        <button onClick={() => changeQty(k, 1)} className="w-6 h-6 rounded grid place-items-center flex-shrink-0" style={{ border: '1px solid var(--hairline)' }} aria-label="Increase"><Plus size={12} /></button>
        <button onClick={() => setPreview((c.cardSnapshot?.name ? c.cardSnapshot : { name: c.cardName }) as ResolvedCard)} className="flex-1 truncate text-left hover:underline" title="Preview">{c.cardName}</button>
        {gc && <span title="Game Changer" className="flex-shrink-0"><Star size={12} style={{ color: 'var(--accent)' }} /></span>}
        {sectionSelect(c, k)}
        <button onClick={() => removeCard(k)} className="w-6 h-6 rounded grid place-items-center flex-shrink-0" style={{ color: 'var(--danger)' }} aria-label="Remove"><Trash2 size={13} /></button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 py-6" style={{ background: 'var(--bg)', color: 'var(--paper)' }}>
      <div className="max-w-6xl mx-auto">
        {/* Stat blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Cards', val: String(totalCount) },
            { label: 'Lands', val: String(stats.types['Land'] ?? 0) },
            { label: 'Creatures', val: String(stats.types['Creature'] ?? 0) },
            { label: 'Avg mana', val: stats.avgCmc.toFixed(2) },
          ].map((b) => (
            <div key={b.label} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
              <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--brand-bright)' }}>{b.val}</div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{b.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
          {/* Search column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <input value={deckName} onChange={(e) => setDeckName(e.target.value)} className="flex-1 rounded-md px-3 h-9 text-sm font-semibold bg-transparent outline-none" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }} aria-label="Deck name" />
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="rounded-md px-2 h-9 text-xs bg-transparent" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }} title="Deck format">
                {FORMATS.map((f) => <option key={f} value={f} style={{ color: '#000' }}>{f[0].toUpperCase() + f.slice(1)}</option>)}
              </select>
              <button onClick={handleSave} disabled={saving || cards.length === 0} className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--accent)', color: '#04101f' }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
              </button>
            </div>
            {savedMsg && <div className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>{savedMsg}</div>}

            {/* Search controls */}
            <form onSubmit={(e) => { e.preventDefault(); runSearch(query) }} className="flex flex-wrap items-center gap-2 mb-1">
              <div className="flex items-center gap-1">
                {SECTIONS.map((s) => (
                  <button key={s.key} type="button" onClick={() => setAddSection(s.key)} className="px-2 h-8 rounded-md text-xs font-semibold" style={{ background: addSection === s.key ? 'var(--paper)' : 'transparent', color: addSection === s.key ? 'var(--ink)' : 'var(--paper)', border: '1px solid var(--hairline)' }}>{s.label}</button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[180px]">
                <div className="flex items-center gap-1 rounded-md px-2 h-9" style={{ border: '1px solid var(--hairline)' }}>
                  <Search size={15} style={{ color: 'var(--muted)' }} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards (e.g. lightning, t:creature)" className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--paper)' }} />
                </div>
                {suggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-md overflow-hidden" style={{ background: 'var(--panel-strong)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-md)' }}>
                    {suggestions.map((s) => <button key={s} type="button" onClick={() => addByName(s)} className="block w-full text-left px-3 py-1.5 text-sm hover:opacity-80" style={{ color: 'var(--paper)' }}>+ {s}</button>)}
                  </div>
                )}
              </div>
              <button type="submit" className="px-3 h-9 rounded-md text-sm font-semibold" style={{ border: '1px solid var(--hairline)' }}>{searching ? '…' : 'Search'}</button>
            </form>
            <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span>Color ID</span>
              <input value={colorId} onChange={(e) => setColorId(e.target.value)} placeholder="wubrg" className="w-20 h-7 px-2 rounded bg-transparent uppercase" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }} />
              <span>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-7 px-1 rounded bg-transparent" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }}>
                {SORTS.map((s) => <option key={s.key} value={s.key} style={{ color: '#000' }}>{s.label}</option>)}
              </select>
              <button type="button" onClick={drawHand} disabled={!cards.some((c) => c.section === 'mainboard')} className="ml-auto inline-flex items-center gap-1 px-2 h-7 rounded disabled:opacity-40" style={{ border: '1px solid var(--hairline)' }}><Hand size={12} /> Draw hand</button>
            </div>
            {searchErr && <div className="mb-2 text-xs" style={{ color: 'var(--danger)' }}>{searchErr}</div>}

            <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {results.map((card) => (
                <div key={card.id} className="group relative rounded-lg overflow-hidden" style={{ border: '1px solid var(--hairline)', aspectRatio: '63 / 88' }}>
                  <button onClick={() => addCard(card, addSection)} className="block w-full h-full text-left" title={'Add ' + card.name}>
                    {getCardImage(card, 'normal') ? <img src={getCardImage(card, 'normal')} alt={card.name} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center text-xs p-2 text-center" style={{ background: 'var(--ink-2)' }}>{card.name}</div>}
                    <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition" style={{ background: 'rgba(0,0,0,0.45)' }}><Plus size={28} color="#fff" /></span>
                  </button>
                  {isGameChanger(card.name) && <span className="absolute top-1 left-1" title="Game Changer"><Star size={14} style={{ color: 'var(--accent)' }} fill="currentColor" /></span>}
                  <button onClick={() => setPreview(card)} className="absolute bottom-1 right-1 w-5 h-5 rounded grid place-items-center text-[10px]" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }} title="Preview">⤢</button>
                </div>
              ))}
            </div>
            {results.length === 0 && !searching && <div className="text-sm py-10 text-center" style={{ color: 'var(--muted)' }}>Search for cards (or type a name) and click to add.</div>}
          </div>

          {/* Deck column */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Deck — {totalCount} cards</span>
                {bracket && <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'var(--accent)', color: '#04101f' }}>Bracket {bracket.bracket}{bracket.subRating ? ' ' + bracket.subRating : ''}</span>}
              </div>
              {cards.length > 3 && <input value={deckFilter} onChange={(e) => setDeckFilter(e.target.value)} placeholder="Filter cards in deck…" className="w-full h-7 px-2 mb-2 rounded text-xs bg-transparent" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }} />}
              {grouped.map((g) => g.items.length > 0 && (
                <div key={g.key} className="mb-3">
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>{g.label} ({g.count})</div>
                  {g.key === 'mainboard'
                    ? byType(g.items).map((grp) => (
                      <div key={grp.type} className="mb-1.5">
                        <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--faint)' }}>{grp.type} ({grp.items.reduce((n, c) => n + c.quantity, 0)})</div>
                        <div className="flex flex-col gap-1">{grp.items.map(row)}</div>
                      </div>
                    ))
                    : <div className="flex flex-col gap-1">{g.items.map(row)}</div>}
                </div>
              ))}
              {cards.length === 0 && <div className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Your deck is empty.</div>}
            </div>

            {cards.length > 0 && (
              <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
                {/* Mana curve */}
                <div>
                  <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Mana curve · avg {stats.avgCmc.toFixed(2)}</div>
                  <div className="flex items-end gap-1.5 h-20">
                    {stats.curve.map((n, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{n || ''}</span>
                        <div className="w-full rounded-t" style={{ height: `${(n / maxCurve) * 100}%`, minHeight: n ? 4 : 0, background: 'var(--accent)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--faint)' }}>{i === 7 ? '7+' : i}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Color ratio profile */}
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Color (pips · lands)</div>
                  <div className="flex h-3 rounded overflow-hidden mb-1">
                    {['W', 'U', 'B', 'R', 'G', 'C'].map((col) => stats.pips[col] ? <div key={col} style={{ width: `${(stats.pips[col] / totalPips) * 100}%`, background: COLOR_TOKENS[col] }} title={`${col}: ${stats.pips[col]} pips`} /> : null)}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    {['W', 'U', 'B', 'R', 'G'].map((col) => (stats.pips[col] || stats.landProd[col]) ? (
                      <span key={col} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_TOKENS[col] }} />{stats.pips[col]}p · {stats.landProd[col]}L</span>
                    ) : null)}
                  </div>
                </div>
                {/* Types */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--paper-dim)' }}>
                  {TYPE_ORDER.map((t) => stats.types[t] ? <span key={t}>{t}: {stats.types[t]}</span> : null)}
                </div>
                {/* Bracket review narrative */}
                {bracket && (
                  <div className="pt-2 text-xs" style={{ borderTop: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                    <div className="mb-1" style={{ color: 'var(--paper-dim)' }}>Ramp {stats.ramp} · Draw {stats.draw} · Interaction {stats.interaction}</div>
                    <div>Game Changers: {bracket.gameChangerCount} · Tutors: {bracket.tutorCount} · Fast mana: {bracket.fastManaCount} · Combos: {bracket.infiniteComboCount}</div>
                  </div>
                )}
                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="pt-2 flex flex-col gap-1" style={{ borderTop: '1px solid var(--hairline)' }}>
                    {warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--danger)' }}><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /><span>{w}</span></div>)}
                  </div>
                )}
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
                <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Recommended upgrades</div>
                <div className="flex flex-col gap-2">
                  {recommendations.map((r) => (
                    <div key={r.name} className="flex items-start gap-2 text-xs">
                      <button onClick={() => addByName(r.name)} className="flex-shrink-0 w-6 h-6 rounded grid place-items-center mt-0.5" style={{ border: '1px solid var(--hairline)', color: 'var(--brand-bright)' }} title={`Add ${r.name}`}><Plus size={12} /></button>
                      <div className="min-w-0">
                        <div className="font-semibold" style={{ color: 'var(--paper)' }}>{r.name} <span className="font-normal" style={{ color: 'var(--faint)' }}>· {r.role}</span></div>
                        <div style={{ color: 'var(--muted)' }}>{r.why}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Notes</div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Goals, budget, upgrades, table notes…" rows={2} className="w-full bg-transparent text-sm outline-none resize-y" style={{ color: 'var(--paper)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Card preview modal */}
      {preview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(2,6,14,0.7)' }} onClick={() => setPreview(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full grid place-items-center z-10" style={{ background: 'var(--panel-strong)', border: '1px solid var(--hairline)' }}><X size={16} /></button>
            {getCardImage(preview, 'large')
              ? <img src={getCardImage(preview, 'large')} alt={preview.name} className="rounded-xl max-h-[80vh]" style={{ boxShadow: 'var(--shadow-lg)' }} />
              : <div className="p-8 rounded-xl text-center" style={{ background: 'var(--panel)' }}>{preview.name}</div>}
            <div className="mt-2 flex items-center justify-center gap-3">
              <button onClick={() => { addCard(preview, addSection); }} className="px-3 h-8 rounded-md text-sm font-semibold" style={{ background: 'var(--accent)', color: '#04101f' }}>+ Add to {SECTIONS.find((s) => s.key === addSection)?.label}</button>
              <a href={`https://scryfall.com/search?q=!"${encodeURIComponent(preview.name)}"&unique=prints`} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: 'var(--brand-bright)' }}>All printings ↗</a>
            </div>
          </div>
        </div>
      )}

      {/* Draw hand modal */}
      {drawOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(2,6,14,0.7)' }} onClick={() => setDrawOpen(false)}>
          <div className="rounded-xl p-5 max-w-2xl w-full" style={{ background: 'var(--panel-strong)', border: '1px solid var(--hairline)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Opening hand</span>
              <div className="flex items-center gap-2">
                <button onClick={drawHand} className="px-3 h-8 rounded-md text-xs font-semibold" style={{ background: 'var(--accent)', color: '#04101f' }}>Mulligan / redraw</button>
                <button onClick={() => setDrawOpen(false)}><X size={16} /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {hand.map((name, i) => <div key={i} className="px-2 py-1.5 rounded text-xs text-center" style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)', minWidth: 110 }}>{name}</div>)}
              {hand.length === 0 && <div className="text-sm" style={{ color: 'var(--muted)' }}>No mainboard cards to draw.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

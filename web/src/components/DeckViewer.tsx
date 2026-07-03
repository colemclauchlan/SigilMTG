/**
 * Sigil — DeckViewer component
 *
 * Renders a loaded deck filterable by card type and color, with a search box.
 * Also shows a mini bracket badge.
 */

import { useState, useMemo } from 'react'
import type { SavedDeck, DeckCardEntry } from '../lib/decks'
import { getCardImage } from '../lib/scryfall'
import type { ResolvedCard } from '../lib/scryfall'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  deck: SavedDeck
  onClose?: () => void
  onCardInspect?: (card: DeckCardEntry) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_FILTERS = ['All', 'Commander', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Other']

const COLOR_FILTERS = [
  { label: 'All', value: '' },
  { label: 'W', value: 'W' },
  { label: 'U', value: 'U' },
  { label: 'B', value: 'B' },
  { label: 'R', value: 'R' },
  { label: 'G', value: 'G' },
  { label: 'C', value: 'C' },
]

const MANA_COLORS: Record<string, string> = {
  W: '#f5e6c8',
  U: '#4aa3e6',
  B: '#9b86c4',
  R: '#e0655c',
  G: '#46b277',
  C: '#c0c0c0',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMainType(typeLine: string): string {
  const types = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land', 'Battle']
  for (const t of types) if (typeLine?.includes(t)) return t
  return 'Other'
}

function getCardColors(card: DeckCardEntry): string[] {
  const snap = card.cardSnapshot as Partial<ResolvedCard> | undefined
  return snap?.color_identity ?? []
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1 mb-1 mt-3 rounded-sm"
      style={{ background: 'var(--ink-2)' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: 'var(--brand-bright)' }}
      >
        {label}
      </span>
      <span
        className="text-[10px] font-mono"
        style={{ color: 'var(--muted)' }}
      >
        ({count})
      </span>
    </div>
  )
}

// ── Card row ──────────────────────────────────────────────────────────────────

function CardRow({
  card,
  onInspect,
}: {
  card: DeckCardEntry
  onInspect?: (card: DeckCardEntry) => void
}) {
  const snap = card.cardSnapshot as Partial<ResolvedCard> | undefined
  const imgUrl = snap?.primaryImage
    ? getCardImage(snap.primaryImage, 'small')
    : undefined
  const colors = getCardColors(card)

  return (
    <div
      className="group flex items-center gap-2 px-3 py-[5px] rounded-sm cursor-pointer transition-all duration-150"
      style={{
        borderLeft: colors.length === 1 ? `3px solid ${MANA_COLORS[colors[0]] ?? 'var(--brand)'}` : `3px solid var(--hairline)`,
      }}
      onClick={() => onInspect?.(card)}
      title={`Inspect ${card.cardName}`}
    >
      {/* Thumbnail */}
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={card.cardName}
          className="w-8 h-11 rounded-[3px] object-cover flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity"
          loading="lazy"
        />
      ) : (
        <div
          className="w-8 h-11 rounded-[3px] flex-shrink-0 flex items-center justify-center text-[8px]"
          style={{ background: 'var(--ink-3)', color: 'var(--faint)' }}
        >
          ?
        </div>
      )}

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <div
          className="text-xs font-semibold truncate group-hover:text-[color:var(--brand-bright)] transition-colors"
          style={{ color: 'var(--paper)' }}
        >
          {card.cardName}
          {card.foil && (
            <span className="ml-1 text-[9px] foil-text">✦</span>
          )}
        </div>
        {snap?.type_line && (
          <div className="text-[10px] truncate" style={{ color: 'var(--faint)' }}>
            {snap.type_line}
          </div>
        )}
      </div>

      {/* Qty */}
      <div
        className="flex-shrink-0 w-5 text-center text-xs font-bold rounded-full"
        style={{
          color: card.quantity > 1 ? 'var(--brand-bright)' : 'var(--muted)',
        }}
      >
        ×{card.quantity}
      </div>

      {/* CMC */}
      {snap?.cmc !== undefined && (
        <div
          className="flex-shrink-0 w-5 text-center text-[10px] rounded-full font-mono"
          style={{ color: 'var(--muted)' }}
        >
          {snap.cmc}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DeckViewer({ deck, onClose, onCardInspect }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [colorFilter, setColorFilter] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')

  const cards = deck.cards ?? []
  const total = cards.reduce((s, c) => s + c.quantity, 0)

  // Filter & group
  const filtered = useMemo(() => {
    return cards.filter((card) => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        if (!card.cardName.toLowerCase().includes(q)) return false
      }

      // Section / type filter
      if (typeFilter !== 'All') {
        if (typeFilter === 'Commander') {
          if (card.section !== 'commander') return false
        } else {
          const snap = card.cardSnapshot as Partial<ResolvedCard> | undefined
          const mt = getMainType(snap?.type_line ?? '')
          if (mt !== typeFilter) return false
        }
      }

      // Color
      if (colorFilter) {
        const colors = getCardColors(card)
        if (colors.length === 0 && colorFilter !== 'C') return false
        if (colors.length === 0 && colorFilter === 'C') return true
        if (!colors.includes(colorFilter)) return false
      }

      return true
    })
  }, [cards, search, typeFilter, colorFilter])

  // Group by section then type
  const grouped = useMemo(() => {
    const sections: Record<string, DeckCardEntry[]> = {
      commander: [],
      creature: [],
      instant: [],
      sorcery: [],
      artifact: [],
      enchantment: [],
      planeswalker: [],
      land: [],
      other: [],
    }
    for (const card of filtered) {
      if (card.section === 'commander') { sections.commander.push(card); continue }
      const snap = card.cardSnapshot as Partial<ResolvedCard> | undefined
      const mt = getMainType(snap?.type_line ?? '').toLowerCase()
      ;(sections[mt] ?? sections.other).push(card)
    }
    return sections
  }, [filtered])

  const sectionOrder = ['commander', 'creature', 'planeswalker', 'instant', 'sorcery', 'artifact', 'enchantment', 'land', 'other']
  const sectionLabels: Record<string, string> = {
    commander: 'Commander',
    creature: 'Creatures',
    instant: 'Instants',
    sorcery: 'Sorceries',
    artifact: 'Artifacts',
    enchantment: 'Enchantments',
    planeswalker: 'Planeswalkers',
    land: 'Lands',
    other: 'Other',
  }

  const bracket = deck.bracket
  const bracketColors: Record<number, string> = {
    1: '#9b86c4', 2: '#46b277', 3: '#4aa3e6', 4: '#e0a030', 5: '#e0655c',
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--panel)', color: 'var(--text)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{
          borderColor: 'var(--hairline)',
          background: 'var(--glass-strong)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Commander art */}
        {deck.commanderArtUrl && (
          <img
            src={deck.commanderArtUrl}
            alt={deck.commanderName}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[var(--hairline)]"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm truncate" style={{ color: 'var(--paper)' }}>
            {deck.name}
          </div>
          {deck.commanderName && (
            <div className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
              {deck.commanderName} · {total} cards
            </div>
          )}
        </div>

        {/* Bracket badge */}
        {bracket && (
          <div
            className="flex-shrink-0 px-2 py-1 rounded-full text-[11px] font-bold font-mono"
            style={{
              background: `${bracketColors[bracket] ?? 'var(--brand)'}22`,
              color: bracketColors[bracket] ?? 'var(--brand)',
              border: `1px solid ${bracketColors[bracket] ?? 'var(--brand)'}55`,
            }}
          >
            B{bracket}
          </div>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-col gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'var(--hairline)', background: 'var(--ink-2)' }}
      >
        {/* Search */}
        <input
          type="search"
          placeholder="Search cards…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 rounded-sm text-xs bg-transparent border"
          style={{
            borderColor: 'var(--hairline)',
            color: 'var(--paper)',
            background: 'var(--ink)',
          }}
        />

        {/* Type filter */}
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all"
              style={{
                background: typeFilter === t ? 'var(--brand)' : 'var(--ink-3)',
                color: typeFilter === t ? '#fff' : 'var(--muted)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Color filter */}
        <div className="flex gap-1 items-center">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Color:</span>
          {COLOR_FILTERS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColorFilter(c.value)}
              className="w-6 h-6 rounded-full text-[10px] font-bold border transition-all"
              style={{
                background: c.value ? (colorFilter === c.value ? MANA_COLORS[c.value] : `${MANA_COLORS[c.value]}33`) : (colorFilter === '' ? 'var(--brand)' : 'var(--ink-3)'),
                color: colorFilter === c.value || (c.value === '' && colorFilter === '') ? '#fff' : 'var(--muted)',
                borderColor: c.value && MANA_COLORS[c.value] ? MANA_COLORS[c.value] : 'var(--hairline)',
              }}
            >
              {c.label}
            </button>
          ))}

          {/* View toggle */}
          <div className="ml-auto flex gap-1">
            {(['list', 'grid'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-2 py-0.5 rounded-sm text-[10px] font-bold transition-all"
                style={{
                  background: view === v ? 'var(--brand)' : 'var(--ink-3)',
                  color: view === v ? '#fff' : 'var(--muted)',
                }}
              >
                {v === 'list' ? '≡' : '⊞'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-2xl">🃏</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>No cards match</span>
          </div>
        ) : view === 'list' ? (
          sectionOrder.map((sec) => {
            const sec_cards = grouped[sec]
            if (!sec_cards || sec_cards.length === 0) return null
            const secTotal = sec_cards.reduce((s, c) => s + c.quantity, 0)
            return (
              <div key={sec}>
                <SectionHeader label={sectionLabels[sec]} count={secTotal} />
                {sec_cards.map((card) => (
                  <CardRow
                    key={`${card.cardName}-${card.section}`}
                    card={card}
                    onInspect={onCardInspect}
                  />
                ))}
              </div>
            )
          })
        ) : (
          // Grid view: card thumbnails
          <div className="grid grid-cols-4 gap-1.5 p-2">
            {filtered.map((card) => {
              const snap = card.cardSnapshot as Partial<ResolvedCard> | undefined
              const imgUrl = snap?.primaryImage ? getCardImage(snap.primaryImage, 'small') : undefined
              return (
                <div
                  key={`${card.cardName}-${card.section}`}
                  className="relative aspect-[5/7] cursor-pointer group"
                  onClick={() => onCardInspect?.(card)}
                  title={card.cardName}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={card.cardName}
                      className="w-full h-full object-cover rounded-[5px] group-hover:ring-2 ring-[var(--brand)]"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded-[5px] flex items-center justify-center text-[9px] text-center px-1"
                      style={{ background: 'var(--ink-3)', color: 'var(--faint)' }}
                    >
                      {card.cardName}
                    </div>
                  )}
                  {card.quantity > 1 && (
                    <div
                      className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: 'var(--brand)', color: '#fff' }}
                    >
                      {card.quantity}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer count */}
      <div
        className="px-4 py-2 text-[10px] border-t flex items-center justify-between"
        style={{ borderColor: 'var(--hairline)', color: 'var(--muted)' }}
      >
        <span>Showing {filtered.length} unique / {filtered.reduce((s, c) => s + c.quantity, 0)} cards</span>
        <span>{total} total in deck</span>
      </div>
    </div>
  )
}

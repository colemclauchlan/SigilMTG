/**
 * TutorModal — search your library, grouped by card type.
 * Click a card to move it to hand and close the modal.
 */
import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { CardInstance } from '../../types/game'

interface TypeGroup {
  label: string
  cards: CardInstance[]
}

const TYPE_ORDER = [
  'Creatures',
  'Lands',
  'Artifacts',
  'Enchantments',
  'Instants',
  'Sorceries',
  'Planeswalkers',
  'Other',
]

function getTypeGroup(card: CardInstance): string {
  const tl = (card.typeLine ?? '').toLowerCase()
  if (tl.includes('creature')) return 'Creatures'
  if (tl.includes('land')) return 'Lands'
  if (tl.includes('artifact')) return 'Artifacts'
  if (tl.includes('enchantment')) return 'Enchantments'
  if (tl.includes('instant')) return 'Instants'
  if (tl.includes('sorcery')) return 'Sorceries'
  if (tl.includes('planeswalker')) return 'Planeswalkers'
  return 'Other'
}

export default function TutorModal() {
  const tutorOpen = useGameStore((s) => s.ui.tutorOpen)
  const openTutor = useGameStore((s) => s.openTutor)
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const imagesById = useGameStore((s) => s.imagesById)
  const { dispatch } = useGameEngine()

  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const close = () => { openTutor(false); setSearch('') }

  // Cards in my library
  const libraryCards: CardInstance[] = useMemo(() => {
    if (!gameState) return []
    return Object.values(gameState.cards)
      .filter((c) => c.zone === 'library' && c.ownerSeat === mySeat)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [gameState, mySeat])

  const filtered = useMemo(() => {
    if (!search.trim()) return libraryCards
    const q = search.toLowerCase()
    return libraryCards.filter((c) => c.name.toLowerCase().includes(q))
  }, [libraryCards, search])

  const groups: TypeGroup[] = useMemo(() => {
    const map: Record<string, CardInstance[]> = {}
    for (const card of filtered) {
      const g = getTypeGroup(card)
      if (!map[g]) map[g] = []
      map[g].push(card)
    }
    return TYPE_ORDER
      .filter((label) => map[label]?.length)
      .map((label) => ({ label, cards: map[label] }))
  }, [filtered])

  function pickCard(card: CardInstance) {
    dispatch({
      t: 'card_move',
      instanceId: card.instanceId,
      toZone: 'hand',
      seat: card.controllerSeat,
      x: null, y: null,
    })
    close()
  }

  function toggleGroup(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <AnimatePresence>
      {tutorOpen && (
        <motion.div
          key="tutor-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 8600,
            background: 'rgba(7,13,26,0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <motion.div
            key="tutor-panel"
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-xl)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--hairline)',
              display: 'flex', alignItems: 'center', gap: 10,
              flexShrink: 0,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                color: 'var(--paper)', fontSize: '1rem', flex: 1,
              }}>
                Tutor
              </span>
              <span style={{
                background: 'var(--ink-2)', color: 'var(--muted)',
                borderRadius: 'var(--r-pill)', padding: '2px 9px',
                fontSize: '0.75rem', fontWeight: 700,
              }}>
                {libraryCards.length} cards
              </span>
              <button
                onClick={close}
                title="Close"
                style={{
                  background: 'var(--ink-2)', border: 'none',
                  borderRadius: 'var(--r-sm)', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--muted)', transition: 'color 0.13s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--paper)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Search */}
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--hairline)',
              flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--ink-2)', borderRadius: 'var(--r-sm)',
                padding: '6px 10px', border: '1px solid var(--hairline)',
              }}>
                <Search size={13} color="var(--faint)" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    color: 'var(--paper)', fontSize: '0.85rem', flex: 1,
                    fontFamily: 'var(--font-body)',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--faint)', padding: 0, lineHeight: 1,
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Groups — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {groups.length === 0 && (
                <p style={{
                  color: 'var(--faint)', fontSize: '0.83rem',
                  textAlign: 'center', padding: '24px 0',
                }}>
                  {search ? 'No matching cards.' : 'Library is empty.'}
                </p>
              )}
              {groups.map(({ label, cards }) => {
                const isCollapsed = collapsed[label] ?? false
                return (
                  <div key={label}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(label)}
                      style={{
                        width: '100%', background: 'none', border: 'none',
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 20px', cursor: 'pointer',
                        color: 'var(--muted)', fontSize: '0.75rem',
                        fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        textAlign: 'left',
                      }}
                    >
                      {isCollapsed
                        ? <ChevronRight size={13} />
                        : <ChevronDown size={13} />}
                      {label}
                      <span style={{
                        background: 'var(--ink-2)', borderRadius: 'var(--r-pill)',
                        padding: '1px 7px', fontSize: '0.7rem',
                        color: 'var(--faint)', marginLeft: 2,
                      }}>
                        {cards.length}
                      </span>
                    </button>

                    {/* Cards list */}
                    {!isCollapsed && (
                      <div>
                        {cards.map((card) => {
                          const meta = card.cardId ? imagesById[card.cardId] : null
                          return (
                            <TutorRow
                              key={card.instanceId}
                              card={card}
                              typeLine={meta?.type ?? card.typeLine ?? ''}
                              onPick={() => pickCard(card)}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Row component ─────────────────────────────────────────────────────────────

interface TutorRowProps {
  card: CardInstance
  typeLine: string
  onPick: () => void
}

function TutorRow({ card, typeLine, onPick }: TutorRowProps) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', background: hov ? 'var(--ink-2)' : 'none',
        border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', padding: '7px 20px 7px 36px',
        gap: 1, transition: 'background 0.1s', textAlign: 'left',
      }}
    >
      <span style={{
        color: 'var(--paper)', fontSize: '0.88rem', fontWeight: 500,
        lineHeight: 1.3,
      }}>
        {card.name}
      </span>
      {typeLine && (
        <span style={{
          color: 'var(--faint)', fontSize: '0.74rem', lineHeight: 1.2,
        }}>
          {typeLine}
        </span>
      )}
    </button>
  )
}

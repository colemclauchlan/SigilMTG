/**
 * FetchLandModal — search library for lands, click to put on battlefield
 * and shuffle library (fetch land rules).
 */
import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Search } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { CardInstance } from '../../types/game'

export default function FetchLandModal() {
  const fetchLandOpen = useGameStore((s) => s.ui.fetchLandOpen)
  const openFetchLand = useGameStore((s) => s.openFetchLand)
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const imagesById = useGameStore((s) => s.imagesById)
  const { dispatch } = useGameEngine()

  const [search, setSearch] = useState('')

  const close = () => { openFetchLand(false); setSearch('') }

  // All lands in my library, sorted alphabetically
  const lands: CardInstance[] = useMemo(() => {
    if (!gameState) return []
    return Object.values(gameState.cards)
      .filter((c) => {
        if (c.zone !== 'library' || c.ownerSeat !== mySeat) return false
        const meta = c.cardId ? imagesById[c.cardId] : null
        const tl = (meta?.type ?? c.typeLine ?? '').toLowerCase()
        return tl.includes('land')
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [gameState, mySeat, imagesById])

  const filtered = useMemo(() => {
    if (!search.trim()) return lands
    const q = search.toLowerCase()
    return lands.filter((c) => c.name.toLowerCase().includes(q))
  }, [lands, search])

  function pickLand(card: CardInstance) {
    // Move to battlefield
    dispatch({
      t: 'card_move',
      instanceId: card.instanceId,
      toZone: 'battlefield',
      seat: card.controllerSeat,
      x: 400,
      y: 300,
    })
    // Shuffle per fetch rules
    dispatch({ t: 'library_shuffle', seat: mySeat })
    close()
  }

  function isBasic(card: CardInstance): boolean {
    const meta = card.cardId ? imagesById[card.cardId] : null
    const tl = (meta?.type ?? card.typeLine ?? '').toLowerCase()
    return tl.includes('basic')
  }

  return (
    <AnimatePresence>
      {fetchLandOpen && (
        <motion.div
          key="fetchland-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 8700,
            background: 'rgba(7,13,26,0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <motion.div
            key="fetchland-panel"
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
              maxWidth: 420,
              maxHeight: '78vh',
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
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#46b277', flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                color: 'var(--paper)', fontSize: '1rem', flex: 1,
              }}>
                Fetch Land
              </span>
              <span style={{
                background: 'var(--ink-2)', color: 'var(--muted)',
                borderRadius: 'var(--r-pill)', padding: '2px 9px',
                fontSize: '0.75rem', fontWeight: 700,
              }}>
                {lands.length} lands
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
                  placeholder="Filter lands…"
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

            {/* Land list — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {filtered.length === 0 && (
                <p style={{
                  color: 'var(--faint)', fontSize: '0.83rem',
                  textAlign: 'center', padding: '24px 0',
                }}>
                  {search ? 'No matching lands.' : 'No lands in library.'}
                </p>
              )}
              {filtered.map((card) => (
                <LandRow
                  key={card.instanceId}
                  card={card}
                  basic={isBasic(card)}
                  onPick={() => pickLand(card)}
                />
              ))}
            </div>

            {/* Footer note */}
            <div style={{
              padding: '10px 20px',
              borderTop: '1px solid var(--hairline)',
              flexShrink: 0,
            }}>
              <p style={{ color: 'var(--faint)', fontSize: '0.75rem', margin: 0 }}>
                Selecting a land puts it onto the battlefield and shuffles your library.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Land row ──────────────────────────────────────────────────────────────────

interface LandRowProps {
  card: CardInstance
  basic: boolean
  onPick: () => void
}

function LandRow({ card, basic, onPick }: LandRowProps) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', background: hov ? 'var(--ink-2)' : 'none',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        padding: '8px 20px', gap: 10,
        transition: 'background 0.1s',
      }}
    >
      {/* Color dot for basic/nonbasic */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: basic ? '#46b277' : '#c9a227',
      }} />
      <span style={{
        color: 'var(--paper)', fontSize: '0.88rem', fontWeight: 500, flex: 1,
        textAlign: 'left',
      }}>
        {card.name}
      </span>
      <span style={{
        color: 'var(--faint)', fontSize: '0.72rem',
        background: 'var(--ink-2)', borderRadius: 'var(--r-pill)',
        padding: '1px 7px', flexShrink: 0,
      }}>
        {basic ? 'Basic' : 'Nonbasic'}
      </span>
    </button>
  )
}

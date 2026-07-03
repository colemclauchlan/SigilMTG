/**
 * ZoneViewer — Library / Graveyard / Exile / Command zone browser.
 * Shows cards in the zone with per-card move buttons and pile actions.
 */
import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X, Search, Shuffle, Hand, Swords, Skull, XCircle, BookOpen,
} from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { CardInstance, Zone } from '../../types/game'

const CARD_BACK = 'https://cards.scryfall.io/normal/back/0/0/default_card_back.jpg'

const ZONE_LABELS: Record<string, string> = {
  library: 'Library',
  graveyard: 'Graveyard',
  exile: 'Exile',
  command: 'Command',
}

const ZONE_COLORS: Record<string, string> = {
  library: '#4da3ff',
  graveyard: '#e0655c',
  exile: '#9b86c4',
  command: '#c9a227',
}

// ── Icon move button (used inside card tiles) ────────────────────────────────

interface IconMoveButtonProps {
  icon: React.ReactNode
  label: string
  hoverColor: string
  onClick: () => void
}

function IconMoveButton({ icon, label, hoverColor, onClick }: IconMoveButtonProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px', borderRadius: 4,
        color: hovered ? hoverColor : 'var(--faint)',
        transition: 'color 0.13s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  )
}

// ── Pile action button ───────────────────────────────────────────────────────

function PileActionBtn({
  label, onClick, danger = false,
}: { label: string; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov
          ? (danger ? 'rgba(224,101,92,0.18)' : 'var(--ink-3)')
          : 'var(--ink-2)',
        border: `1px solid ${hov ? (danger ? '#e0655c' : 'var(--brand)') : 'var(--hairline)'}`,
        borderRadius: 'var(--r-sm)',
        color: danger ? '#e0655c' : 'var(--paper-dim)',
        padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.13s',
      }}
    >
      {label}
    </button>
  )
}

// ── Card tile ────────────────────────────────────────────────────────────────

interface CardTileProps {
  card: CardInstance
  imgSrc: string
  zone: Zone
  onMove: (toZone: Zone) => void
}

function CardTile({ card, imgSrc, zone, onMove }: CardTileProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        width: 80,
      }}
    >
      <div style={{ position: 'relative', width: 80 }}>
        <img
          src={imgSrc}
          alt={card.name}
          title={card.name}
          onError={(e) => { (e.target as HTMLImageElement).src = CARD_BACK }}
          style={{
            width: 80, height: Math.round(80 * 1.4),
            borderRadius: 'var(--r-sm)',
            objectFit: 'cover', display: 'block',
            boxShadow: hovered ? '0 0 0 2px var(--brand)' : 'var(--shadow-sm)',
            transition: 'box-shadow 0.15s',
          }}
        />
        {hovered && (
          <div style={{
            position: 'absolute', bottom: '100%', left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--ink-3)', color: 'var(--paper)',
            fontSize: '0.7rem', fontWeight: 600,
            padding: '3px 7px', borderRadius: 'var(--r-sm)',
            whiteSpace: 'nowrap', marginBottom: 4,
            pointerEvents: 'none', zIndex: 10,
            boxShadow: 'var(--shadow-sm)',
            maxWidth: 140, textAlign: 'center',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {card.name}
          </div>
        )}
      </div>

      {/* Icon buttons row */}
      <div style={{
        display: 'flex', gap: 2,
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.13s',
        background: 'var(--ink-2)',
        borderRadius: 'var(--r-sm)',
        padding: '2px 3px',
        border: '1px solid var(--hairline)',
      }}>
        <IconMoveButton
          icon={<Hand size={11} />}
          label="To Hand"
          hoverColor="#2dd4bf"
          onClick={() => onMove('hand')}
        />
        <IconMoveButton
          icon={<Swords size={11} />}
          label="To Battlefield"
          hoverColor="#46b277"
          onClick={() => onMove('battlefield')}
        />
        {zone !== 'graveyard' && (
          <IconMoveButton
            icon={<Skull size={11} />}
            label="To Graveyard"
            hoverColor="#e0655c"
            onClick={() => onMove('graveyard')}
          />
        )}
        {zone !== 'exile' && (
          <IconMoveButton
            icon={<XCircle size={11} />}
            label="To Exile"
            hoverColor="#9b86c4"
            onClick={() => onMove('exile')}
          />
        )}
        {zone !== 'library' && (
          <IconMoveButton
            icon={<BookOpen size={11} />}
            label="To Library (bottom)"
            hoverColor="#4da3ff"
            onClick={() => onMove('library')}
          />
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ZoneViewer() {
  const viewerZone = useGameStore((s) => s.ui.viewerZone)
  const viewerSeat = useGameStore((s) => s.ui.viewerSeat)
  const openViewer = useGameStore((s) => s.openViewer)
  const gameState = useGameStore((s) => s.gameState)
  const imagesById = useGameStore((s) => s.imagesById)
  const mySeat = useGameStore((s) => s.mySeat)
  const { dispatch } = useGameEngine()

  const [search, setSearch] = useState('')

  const close = () => openViewer(null)

  const allCards: CardInstance[] = useMemo(() => {
    if (!gameState || !viewerZone) return []
    return Object.values(gameState.cards)
      .filter((c) => c.zone === viewerZone && c.ownerSeat === viewerSeat)
      .sort((a, b) => a.pos - b.pos)
  }, [gameState, viewerZone, viewerSeat])

  const filtered = useMemo(() => {
    if (!search.trim()) return allCards
    const q = search.toLowerCase()
    return allCards.filter((c) => c.name.toLowerCase().includes(q))
  }, [allCards, search])

  function cardImg(card: CardInstance): string {
    if (viewerZone === 'library') {
      const revealed = card.revealedTo.includes(mySeat)
      if (!revealed) return CARD_BACK
    }
    const meta = card.cardId ? imagesById[card.cardId] : null
    return meta?.img ?? CARD_BACK
  }

  function moveCard(card: CardInstance, toZone: Zone) {
    dispatch({
      t: 'card_move',
      instanceId: card.instanceId,
      toZone,
      seat: card.controllerSeat,
      x: null,
      y: null,
    })
  }

  function shuffleLibrary() {
    dispatch({ t: 'library_shuffle', seat: viewerSeat })
  }

  function shuffleAllIn() {
    for (const c of allCards) {
      dispatch({
        t: 'card_move',
        instanceId: c.instanceId,
        toZone: 'library',
        seat: c.controllerSeat,
        x: null, y: null,
      })
    }
    dispatch({ t: 'library_shuffle', seat: viewerSeat })
  }

  function exileAll() {
    for (const c of allCards) {
      dispatch({
        t: 'card_move',
        instanceId: c.instanceId,
        toZone: 'exile',
        seat: c.controllerSeat,
        x: null, y: null,
      })
    }
  }

  function toBottomAll() {
    for (const c of allCards) {
      dispatch({
        t: 'card_move',
        instanceId: c.instanceId,
        toZone: 'library',
        seat: c.controllerSeat,
        x: null, y: null,
      })
    }
  }

  const zoneLabel = viewerZone ? (ZONE_LABELS[viewerZone] ?? viewerZone) : ''
  const zoneColor = viewerZone ? (ZONE_COLORS[viewerZone] ?? 'var(--brand)') : 'var(--brand)'
  const isLibrary = viewerZone === 'library'
  const isGraveyard = viewerZone === 'graveyard'

  return (
    <AnimatePresence>
      {viewerZone && (
        <motion.div
          key="zoneviewer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 8500,
            background: 'rgba(7,13,26,0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
          }}
        >
          <motion.div
            key="zoneviewer-panel"
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 48 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderLeft: `2px solid ${zoneColor}`,
              width: '100%',
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--hairline)',
              display: 'flex', alignItems: 'center', gap: 12,
              flexShrink: 0,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: zoneColor, flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                color: 'var(--paper)', fontSize: '1rem', flex: 1,
              }}>
                {zoneLabel}
              </span>
              <span style={{
                background: 'var(--ink-2)', color: 'var(--muted)',
                borderRadius: 'var(--r-pill)', padding: '2px 9px',
                fontSize: '0.75rem', fontWeight: 700,
              }}>
                {allCards.length}
              </span>
              {isLibrary && (
                <button
                  onClick={shuffleLibrary}
                  title="Shuffle library"
                  style={{
                    background: 'var(--ink-2)', border: 'none',
                    borderRadius: 'var(--r-sm)', width: 30, height: 30,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--muted)',
                    transition: 'color 0.13s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#4da3ff' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
                >
                  <Shuffle size={14} />
                </button>
              )}
              <button
                onClick={close}
                title="Close"
                style={{
                  background: 'var(--ink-2)', border: 'none',
                  borderRadius: 'var(--r-sm)', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--muted)',
                  transition: 'color 0.13s',
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
                  type="text"
                  placeholder="Filter by name…"
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

            {/* Card grid */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignContent: 'flex-start',
            }}>
              {filtered.length === 0 && (
                <p style={{
                  color: 'var(--faint)', fontSize: '0.83rem',
                  width: '100%', textAlign: 'center', padding: '24px 0',
                }}>
                  {search ? 'No matching cards.' : 'No cards in this zone.'}
                </p>
              )}
              {filtered.map((card) => (
                <CardTile
                  key={card.instanceId}
                  card={card}
                  imgSrc={cardImg(card)}
                  zone={viewerZone}
                  onMove={(toZone) => moveCard(card, toZone)}
                />
              ))}
            </div>

            {/* Pile actions footer */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--hairline)',
              display: 'flex', gap: 8, flexWrap: 'wrap',
              flexShrink: 0,
            }}>
              <PileActionBtn label="Shuffle in" onClick={shuffleAllIn} />
              {isGraveyard && (
                <>
                  <PileActionBtn label="Exile all" onClick={exileAll} danger />
                  <PileActionBtn label="To bottom" onClick={toBottomAll} />
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * ZonePile — compact pile widget for library / graveyard / exile / command zone.
 */
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import type { Zone } from '../../types/game'

const CARD_BACK = 'https://cards.scryfall.io/normal/back/0/0/default_card_back.jpg'

interface ZonePileProps {
  zone: Zone
  seat: number
  count: number
  topCardImg?: string
}

const ZONE_META: Record<Zone, { label: string; color: string; bg: string }> = {
  library:   { label: 'Library',   color: '#4da3ff', bg: 'rgba(77,163,255,0.18)' },
  graveyard: { label: 'Grave',     color: '#e0655c', bg: 'rgba(224,101,92,0.18)' },
  exile:     { label: 'Exile',     color: '#9b86c4', bg: 'rgba(155,134,196,0.18)' },
  command:   { label: 'Command',   color: '#c9a84c', bg: 'rgba(201,168,76,0.18)' },
  hand:      { label: 'Hand',      color: '#90a4c2', bg: 'rgba(144,164,194,0.18)' },
  battlefield: { label: 'Field',   color: '#46b277', bg: 'rgba(70,178,119,0.18)' },
  stack:     { label: 'Stack',     color: '#eef4ff', bg: 'rgba(238,244,255,0.12)' },
}

export default function ZonePile({ zone, seat, count, topCardImg }: ZonePileProps) {
  const openPileMenu = useGameStore((s) => s.openPileMenu)
  const setGameState = useGameStore((s) => s.setGameState)
  const dropHighlightZone = useGameStore((s) => s.ui.dropHighlightZone)
  const setDropHighlight = useGameStore((s) => s.setDropHighlight)
  const openViewer = useGameStore((s) => s.openViewer)
  const mySeat = useGameStore((s) => s.mySeat)

  const meta = ZONE_META[zone] ?? ZONE_META.library
  const isHighlighted = dropHighlightZone === zone

  // Resolve image to show
  const showBack = zone === 'library' || !topCardImg
  const imgSrc = showBack ? CARD_BACK : topCardImg

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (zone === 'library' && count > 0 && seat === mySeat && window.MTGCore) {
      const gs = useGameStore.getState().gameState
      if (gs) {
        const next = window.MTGCore.reduce(gs as unknown as Record<string, unknown>, { t: 'draw', seat, count: 1 })
        setGameState(next as unknown as typeof gs)
      }
    } else if (zone !== 'library' && count > 0) {
      openViewer(zone, seat)
    }
  }

  function handleRightClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    openPileMenu(zone, { x: e.clientX, y: e.clientY })
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDropHighlight(zone)
  }

  function handleDragLeave() {
    setDropHighlight(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDropHighlight(null)
    const cardId = e.dataTransfer.getData('card-instance-id')
    if (!cardId || !window.MTGCore) return
    const gs = useGameStore.getState().gameState
    if (!gs) return
    const next = window.MTGCore.reduce(gs as unknown as Record<string, unknown>, {
      t: 'card_move',
      instanceId: cardId,
      toZone: zone,
      seat,
    })
    setGameState(next as unknown as typeof gs)
  }

  return (
    <motion.div
      data-zone={zone}
      data-seat={seat}
      onClick={handleClick}
      onContextMenu={handleRightClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      whileHover={{ scale: 1.05 }}
      animate={{
        boxShadow: isHighlighted
          ? `0 0 0 2px ${meta.color}, 0 0 16px ${meta.color}44`
          : '0 2px 8px rgba(0,0,0,0.5)',
      }}
      transition={{ duration: 0.15 }}
      style={{
        width: 56,
        borderRadius: 'var(--r-md)',
        background: isHighlighted ? meta.bg : 'rgba(14,26,46,0.72)',
        border: `1px solid ${isHighlighted ? meta.color : 'rgba(120,170,230,0.14)'}`,
        cursor: (zone === 'library' || count > 0) ? 'pointer' : 'context-menu',
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
      }}
      title={`${meta.label} (${count})`}
    >
      {/* Card thumbnail */}
      <div style={{ width: 56, height: 40, overflow: 'hidden', position: 'relative' }}>
        {count > 0 ? (
          <img
            src={imgSrc}
            alt={meta.label}
            draggable={false}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              objectPosition: 'top', display: 'block',
              filter: zone === 'graveyard' ? 'sepia(0.3) brightness(0.8)' : undefined,
            }}
            onError={(e) => { (e.target as HTMLImageElement).src = CARD_BACK }}
          />
        ) : (
          <div
            style={{
              width: '100%', height: '100%',
              background: meta.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 18, opacity: 0.4 }}>—</span>
          </div>
        )}
      </div>

      {/* Zone name + count */}
      <div
        style={{
          width: '100%', padding: '3px 4px',
          textAlign: 'center',
          background: 'rgba(7,13,26,0.55)',
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: meta.color, lineHeight: 1.2 }}>
          {meta.label.toUpperCase()}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--paper)', lineHeight: 1.1 }}>
          {count}
        </div>
      </div>
    </motion.div>
  )
}

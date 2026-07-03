/**
 * BoardMat — per-player mat region within the canvas.
 * Renders the seat's battlefield cards + zone piles.
 */
import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import type { CardInstance, Zone } from '../../types/game'
import CardNode from './CardNode'
import ZonePile from './ZonePile'

const SEAT_COLORS = [
  { tint: 'rgba(77,163,255,0.07)', border: 'rgba(77,163,255,0.18)', label: '#4da3ff' },   // seat 0 teal
  { tint: 'rgba(201,168,76,0.07)', border: 'rgba(201,168,76,0.18)', label: '#c9a84c' },   // seat 1 amber
  { tint: 'rgba(155,134,196,0.07)', border: 'rgba(155,134,196,0.18)', label: '#9b86c4' }, // seat 2 violet
  { tint: 'rgba(224,101,92,0.07)', border: 'rgba(224,101,92,0.18)', label: '#e0655c' },   // seat 3 rose
]

export interface SeatRegion {
  x: number
  y: number
  w: number
  h: number
  rot: number // degrees (0 or 180)
}

interface BoardMatProps {
  seat: number
  region: SeatRegion
  mySeat: number
}

const PILE_ZONES: Zone[] = ['library', 'graveyard', 'exile', 'command']

export default function BoardMat({ seat, region, mySeat }: BoardMatProps) {
  const gameState = useGameStore((s) => s.gameState)
  const imagesById = useGameStore((s) => s.imagesById)

  const color = SEAT_COLORS[seat % SEAT_COLORS.length]
  const isMe = seat === mySeat
  const player = gameState?.players[seat]

  const battlefieldCards: CardInstance[] = useMemo(() => {
    if (!gameState) return []
    return Object.values(gameState.cards).filter(
      (c) => c.zone === 'battlefield' && c.controllerSeat === seat
    )
  }, [gameState, seat])

  // Zone counts + top card images for piles
  const zoneCounts = useMemo(() => {
    if (!gameState) return {} as Record<Zone, number>
    const counts: Partial<Record<Zone, number>> = {}
    for (const z of PILE_ZONES) {
      counts[z] = Object.values(gameState.cards).filter(
        (c) => c.zone === z && (c.ownerSeat === seat || (z === 'command' && c.ownerSeat === seat))
      ).length
    }
    return counts as Record<Zone, number>
  }, [gameState, seat])

  const topCardImgs = useMemo(() => {
    if (!gameState) return {} as Partial<Record<Zone, string>>
    const imgs: Partial<Record<Zone, string>> = {}
    for (const z of PILE_ZONES) {
      if (z === 'library') continue
      const top = Object.values(gameState.cards)
        .filter((c) => c.zone === z && c.ownerSeat === seat)
        .sort((a, b) => b.pos - a.pos)[0]
      if (top?.cardId && imagesById[top.cardId]?.img) {
        imgs[z] = imagesById[top.cardId].img
      }
    }
    return imgs
  }, [gameState, seat, imagesById])

  return (
    <div
      data-seat-mat={seat}
      data-region-w={region.w}
      data-region-h={region.h}
      style={{
        position: 'absolute',
        left: region.x,
        top: region.y,
        width: region.w,
        height: region.h,
        transform: region.rot !== 0 ? `rotate(${region.rot}deg)` : undefined,
        transformOrigin: 'center center',
        borderRadius: 'var(--r-lg)',
        background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${color.tint}, transparent 70%)`,
        border: `1px solid ${color.border}`,
        overflow: 'visible',
      }}
    >
      {/* Seat label for opponents */}
      {!isMe && player && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: color.label,
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.04em',
            }}
          >
            {player.name ?? `Player ${seat + 1}`}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--paper)',
              fontFamily: 'var(--font-body)',
            }}
          >
            ♥ {player.life}
          </span>
        </div>
      )}

      {/* Battlefield cards */}
      {battlefieldCards.map((card) => (
        <CardNode
          key={card.instanceId}
          card={card}
          context="board"
          canDrag={isMe}
        />
      ))}

      {/* Zone piles — bottom-right cluster */}
      <div
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 5,
        }}
      >
        {PILE_ZONES.map((z) => (
          <ZonePile
            key={z}
            zone={z}
            seat={seat}
            count={zoneCounts[z] ?? 0}
            topCardImg={topCardImgs[z]}
          />
        ))}
      </div>
    </div>
  )
}

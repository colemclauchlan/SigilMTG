/**
 * HandZone — fixed-position hand tray at the bottom of the viewport.
 * Shows the local player's hand cards in a fan layout.
 */
import { useGameStore } from '../../store/gameStore'
import type { CardInstance } from '../../types/game'
import CardNode from './CardNode'

interface HandZoneProps {
  seat: number
}

export default function HandZone({ seat }: HandZoneProps) {
  const gameState = useGameStore((s) => s.gameState)

  if (!gameState) return null

  const handCards: CardInstance[] = Object.values(gameState.cards)
    .filter((c) => c.zone === 'hand' && c.controllerSeat === seat)
    .sort((a, b) => a.pos - b.pos)

  if (handCards.length === 0) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          padding: '6px 16px',
          pointerEvents: 'none',
          color: 'var(--muted)',
          fontSize: 12,
          fontFamily: 'var(--font-body)',
        }}
      >
        Hand empty
      </div>
    )
  }

  // Fan parameters
  const n = handCards.length
  const maxFanDeg = Math.min(22, n * 3.5)
  const maxLift = 12

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
        padding: '0 16px 8px',
        // allow scrolling if many cards
        maxWidth: '96vw',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      {handCards.map((card, i) => {
        // compute fan rotation: spread from -maxFanDeg/2 to +maxFanDeg/2
        const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1 // -1..1
        const fanRot = t * (maxFanDeg / 2)
        const fanLift = maxLift * (1 - Math.abs(t))

        return (
          <CardNode
            key={card.instanceId}
            card={card}
            context="hand"
            seat={seat}
            fanRot={fanRot}
            fanLift={fanLift}
          />
        )
      })}
    </div>
  )
}

/**
 * CmdrDamageIcons — small yellow circle icons w/ commander portrait (§5 #49).
 * One per source that has dealt damage to the local player.
 * Rendered near the life total.
 */
import { useGameStore } from '../../store/gameStore'

interface CmdrDamageIconsProps {
  mySeat: number
}

export default function CmdrDamageIcons({ mySeat }: CmdrDamageIconsProps) {
  const gameState = useGameStore((s) => s.gameState)
  const imagesById = useGameStore((s) => s.imagesById)

  if (!gameState) return null

  const me = gameState.players[mySeat]
  if (!me?.cmdDamage) return null

  const entries = Object.entries(me.cmdDamage).filter(([, v]) => v > 0)
  if (entries.length === 0) return null

  function cmdPortrait(seat: number): string | null {
    const cards = Object.values(gameState!.cards)
    const cmdCard = cards.find(
      (c) => c.ownerSeat === seat && c.isCommander
    )
    if (!cmdCard) return null
    return imagesById[cmdCard.name]?.img ?? cmdCard.imageUri ?? null
  }

  function playerName(seat: number) {
    return gameState!.players[seat]?.name ?? `P${seat + 1}`
  }

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {entries.map(([seatStr, damage]) => {
        const seat = Number(seatStr)
        const art = cmdPortrait(seat)
        const dead = damage >= 21

        return (
          <div
            key={seatStr}
            title={`${damage} commander damage from ${playerName(seat)}${dead ? ' — FATAL!' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: 'default',
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                border: `2px solid ${dead ? 'var(--danger)' : 'rgba(234,194,90,0.7)'}`,
                overflow: 'hidden',
                background: art ? 'none' : 'var(--ink-3)',
                backgroundImage: art ? `url('${art}')` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center 15%',
                boxShadow: dead
                  ? '0 0 6px rgba(224,101,92,0.6)'
                  : '0 0 5px rgba(234,194,90,0.4)',
                flexShrink: 0,
              }}
            >
              {!art && (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12,
                }}>
                  ⚔
                </div>
              )}
            </div>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: dead ? 'var(--danger)' : 'rgba(234,194,90,0.9)',
              lineHeight: 1,
              fontFamily: 'var(--font-body)',
            }}>
              {damage}
            </span>
          </div>
        )
      })}
    </div>
  )
}

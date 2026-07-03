/**
 * HoverPreview — vanilla table.js exploded-preview parity.
 * A large aspect-correct image of the hovered card, pinned to the LEFT edge.
 * Driven by ui.hoveredCardId (board + hand). Token badge; click opens inspect.
 */
import { useGameStore } from '../../store/gameStore'

export default function HoverPreview() {
  const hoveredId = useGameStore((s) => s.ui.hoveredCardId)
  const gameState = useGameStore((s) => s.gameState)
  const imagesById = useGameStore((s) => s.imagesById)

  if (!hoveredId || !gameState) return null
  const card = gameState.cards[hoveredId]
  if (!card) return null
  const meta = card.cardId ? imagesById[card.cardId] : null
  const img = card.faceDown ? undefined : meta?.img

  return (
    <div
      style={{
        position: 'fixed', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 47,
        width: 'clamp(180px, 17vw, 250px)', aspectRatio: '5 / 7', borderRadius: 'var(--r-card)',
        overflow: 'hidden', background: 'var(--ink-2)', border: '1px solid var(--hairline)',
        boxShadow: 'var(--shadow-lg)', cursor: 'default', pointerEvents: 'none',
      }}
    >
      {img
        ? <img src={img} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', padding: 12, textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-300)', fontWeight: 600 }}>
            {card.faceDown ? 'Face-down card' : card.name}
          </div>
        )}
      {card.isToken && (
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'rgba(77,163,255,0.85)', color: '#04101f', fontSize: 'var(--fs-100)', fontWeight: 700, letterSpacing: '0.05em' }}>TOKEN</span>
      )}
    </div>
  )
}

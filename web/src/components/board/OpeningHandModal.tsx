/**
 * OpeningHandModal — vanilla play-shell.js openingHand() parity.
 * Full-screen review of the opening 7 with Mulligan (reshuffle + draw 7) and
 * Keep hand. London-mulligan: after keeping with N mulligans, bottom N cards.
 * Shows a "Shuffling your deck..." placeholder until the hand/images arrive.
 */
import { useState } from 'react'
import { RefreshCw, Check } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

export default function OpeningHandModal() {
  const open = useGameStore((s) => s.ui.openingHandOpen)
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const imagesById = useGameStore((s) => s.imagesById)
  const setUI = useGameStore((s) => s.setUI)
  const setMulliganBottom = useGameStore((s) => s.setMulliganBottom)
  const { dispatch } = useGameEngine()
  const [mulls, setMulls] = useState(0)

  if (!open || !gameState) return null

  const hand = Object.values(gameState.cards)
    .filter((c) => c.zone === 'hand' && c.controllerSeat === mySeat)
    .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))

  const mulligan = () => {
    hand.forEach((c) => dispatch({ t: 'card_move', instanceId: c.instanceId, toZone: 'library', toSeat: mySeat } as never))
    dispatch({ t: 'library_shuffle', seat: mySeat } as never)
    dispatch({ t: 'draw', seat: mySeat, count: 7 } as never)
    setMulls((n) => n + 1)
  }
  const keep = () => {
    if (mulls > 0) setMulliganBottom(mulls)
    setUI({ openingHandOpen: false })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24,
        background: 'rgba(4,8,16,0.82)', backdropFilter: 'blur(8px)',
      }}
    >
      <h2 style={{ fontSize: 'var(--fs-600)', fontWeight: 700, color: 'var(--paper)' }}>Opening Hand</h2>
      {mulls > 0 && (
        <p style={{ color: 'var(--brand-bright)', fontSize: 'var(--fs-200)' }}>
          London mulligan #{mulls} — keep, then put {mulls} card{mulls > 1 ? 's' : ''} on the bottom.
        </p>
      )}

      {hand.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-300)' }}>Shuffling your deck…</p>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 'min(92vw, 1100px)' }}>
          {hand.map((c) => {
            const img = imagesById[c.cardId ?? '']?.img
            return (
              <div
                key={c.instanceId}
                style={{
                  width: 'clamp(96px, 13vw, 150px)', aspectRatio: '5 / 7', borderRadius: 'var(--r-card)',
                  overflow: 'hidden', background: 'var(--ink-2)', border: '1px solid var(--hairline)',
                  boxShadow: 'var(--shadow-md)', display: 'grid', placeItems: 'center',
                }}
              >
                {img
                  ? <img src={img} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-100)', textAlign: 'center', padding: 6 }}>{c.name}</span>}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={mulligan}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontSize: 'var(--fs-300)', fontWeight: 700, cursor: 'pointer' }}
        >
          <RefreshCw size={15} /> Mulligan
        </button>
        <button
          onClick={keep}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 24px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--brand)', color: '#04101f', fontSize: 'var(--fs-300)', fontWeight: 700, cursor: 'pointer' }}
        >
          <Check size={15} /> Keep hand
        </button>
      </div>
    </div>
  )
}

/**
 * MulliganButton — reads from store; dispatches mulligan sequence.
 * Disabled after first card played (mulliganDisabled) or off-turn.
 */
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

export default function MulliganButton() {
  const mulliganDisabled = useGameStore((s) => s.ui.mulliganDisabled)
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const [mulliganCount, setMulliganCount] = useState(0)
  const setMulliganBottom = useGameStore((s) => s.setMulliganBottom)
  const { dispatch } = useGameEngine()

  if (!gameState) return null

  const isMyTurn = gameState.activeSeat === mySeat
  const disabled = mulliganDisabled || !isMyTurn

  const handleMulligan = () => {
    if (disabled) return

    // Move all hand cards to library
    const handCards = Object.values(gameState.cards).filter(
      (c) => c.zone === 'hand' && c.controllerSeat === mySeat
    )
    for (const card of handCards) {
      dispatch({ t: 'card_move', instanceId: card.instanceId, toZone: 'library', toSeat: mySeat })
    }

    // Shuffle library
    dispatch({ t: 'library_shuffle', seat: mySeat })

    // Draw 7 cards
    dispatch({ t: 'draw', seat: mySeat, count: 7 })

    setMulliganCount((n) => n + 1)
    setMulliganBottom(mulliganCount + 1)
  }

  const tooltip = mulliganDisabled
    ? 'Mulligan disabled after first card played'
    : !isMyTurn
    ? 'Not your turn'
    : mulliganCount > 0
    ? `Mulligan #${mulliganCount} taken`
    : 'Take a mulligan'

  return (
    <button
      onClick={handleMulligan}
      disabled={disabled}
      title={tooltip}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--hairline)',
        background: disabled ? 'transparent' : 'var(--ink-2)',
        color: disabled ? 'var(--faint)' : 'var(--paper-dim)',
        fontSize: 'var(--fs-200)',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 140ms, opacity 140ms',
        whiteSpace: 'nowrap',
      }}
    >
      <RefreshCw size={12} strokeWidth={2.2} />
      {mulliganCount > 0 ? `Mull #${mulliganCount}` : 'Mulligan'}
    </button>
  )
}

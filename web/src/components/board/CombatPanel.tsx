/**
 * CombatPanel — combat resolution (audit gap #11).
 * Visible when ≥1 battlefield creature is declared as an attacker. Sums their
 * power (oracle P/T + counters), picks a defending player, and deals the damage
 * (adjust_life) + clears attackers. In solo the only defender is yourself.
 */
import { useState } from 'react'
import { Swords } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

export default function CombatPanel() {
  const gameState = useGameStore((s) => s.gameState)
  const imagesById = useGameStore((s) => s.imagesById)
  const mySeat = useGameStore((s) => s.mySeat)
  const { dispatch } = useGameEngine()
  const [target, setTarget] = useState<number | null>(null)

  if (!gameState) return null
  const attackers = Object.values(gameState.cards).filter((c) => c.zone === 'battlefield' && c.attacking && c.controllerSeat === mySeat)
  if (!attackers.length) return null

  let total = 0
  for (const c of attackers) {
    const meta = c.cardId ? imagesById[c.cardId] : null
    let p = Number(c.oraclePower ?? meta?.pt?.[0] ?? 0)
    if (Number.isNaN(p)) p = 0
    p += (c.counters['+1/+1'] ?? 0) - (c.counters['-1/-1'] ?? 0)
    total += Math.max(0, p)
  }

  const opponents = Array.from({ length: gameState.seats }, (_, i) => i).filter((s) => s !== mySeat)
  const defenders = opponents.length ? opponents : [mySeat]
  const tgt = target != null && defenders.includes(target) ? target : defenders[0]
  const name = (s: number) => gameState.players[s]?.name ?? `Seat ${s + 1}`

  function clearAll() { attackers.forEach((c) => dispatch({ t: 'card_combat', instanceId: c.instanceId, attacking: false } as never)) }
  function resolve() { dispatch({ t: 'adjust_life', seat: tgt, delta: -total } as never); clearAll() }

  return (
    <div className="fixed top-14 right-2 z-[62] w-56 rounded-xl p-3" style={{ background: 'var(--panel-strong)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-lg)' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--paper)' }}><Swords size={13} /> Combat</div>
      <div className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{attackers.length} attacker{attackers.length > 1 ? 's' : ''} · <span style={{ color: 'var(--paper)', fontWeight: 700 }}>{total}</span> power</div>
      <label className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--muted)' }}>To
        <select value={tgt} onChange={(e) => setTarget(Number(e.target.value))} className="flex-1 h-7 px-1 rounded bg-transparent" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }}>
          {defenders.map((s) => <option key={s} value={s} style={{ color: '#000' }}>{name(s)}</option>)}
        </select>
      </label>
      <div className="flex gap-1.5">
        <button onClick={resolve} className="flex-1 h-8 rounded-md text-xs font-semibold" style={{ background: 'var(--danger)', color: '#fff' }}>Deal {total}</button>
        <button onClick={clearAll} className="px-2 h-8 rounded-md text-xs font-semibold" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>Clear</button>
      </div>
    </div>
  )
}

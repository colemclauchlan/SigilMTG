/**
 * StackPanel — the spell stack with Resolve (top) / Destroy actions (audit gap #15).
 * Visible only when cards are in the 'stack' zone. The local engine has no
 * stack_resolve action, so resolve/destroy are done via card_move:
 *  - Resolve top: permanents -> battlefield, instants/sorceries -> graveyard.
 *  - Destroy: -> graveyard.
 */
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { CardInstance } from '../../types/game'
import { X, ChevronsDown } from 'lucide-react'

export default function StackPanel() {
  const gameState = useGameStore((s) => s.gameState)
  const imagesById = useGameStore((s) => s.imagesById)
  const { dispatch } = useGameEngine()
  if (!gameState) return null
  const stack = Object.values(gameState.cards).filter((c) => c.zone === 'stack').sort((a, b) => b.pos - a.pos)
  if (!stack.length) return null

  function isPermanent(c: CardInstance): boolean {
    if (c.isCreature) return true
    const type = (imagesById[c.cardId ?? '']?.type ?? c.typeLine ?? '').toLowerCase()
    if (!type) return true
    return !/instant|sorcery/.test(type)
  }
  function resolveTop() {
    const top = stack[0]
    dispatch({ t: 'card_move', instanceId: top.instanceId, toZone: isPermanent(top) ? 'battlefield' : 'graveyard', x: 50, y: 55 } as never)
  }
  function destroy(c: CardInstance) {
    dispatch({ t: 'card_move', instanceId: c.instanceId, toZone: 'graveyard' } as never)
  }

  return (
    <div className="fixed z-[60] right-2 top-1/2 -translate-y-1/2 w-52 rounded-xl p-3" style={{ background: 'var(--panel-strong)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-lg)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--paper)' }}>Stack ({stack.length})</span>
        <button onClick={resolveTop} className="inline-flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold" style={{ background: 'var(--accent)', color: '#04101f' }}><ChevronsDown size={12} /> Resolve</button>
      </div>
      <div className="flex flex-col gap-1">
        {stack.map((c, i) => (
          <div key={c.instanceId} className="flex items-center gap-2 text-xs rounded px-2 py-1" style={{ background: i === 0 ? 'var(--brand-soft)' : 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
            <span className="flex-1 truncate" style={{ color: 'var(--paper)' }}>{c.name}</span>
            {i === 0 && <span className="text-[9px] px-1 rounded font-bold" style={{ background: 'var(--accent)', color: '#04101f' }}>TOP</span>}
            <button onClick={() => destroy(c)} title="Destroy (to graveyard)" style={{ color: 'var(--danger)' }}><X size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

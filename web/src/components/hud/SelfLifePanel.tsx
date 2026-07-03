/**
 * SelfLifePanel — vanilla play-hud.js buildLife()/updateLife() parity.
 * Top-right rich card for MY seat: faint commander art, name + swatch, big life
 * with -/+ steppers, live Library/Graveyard/Exile counts, and a Commander-damage
 * matrix modal (rows per player, a cell per other seat).
 */
import { useState, useMemo } from 'react'
import { Swords } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { GameState } from '../../types/game'

const SEAT_COLORS = ['#4da3ff', '#e0655c', '#46b277', '#eef0ea', '#9b86c4']
const sc = (seat: number) => SEAT_COLORS[seat % SEAT_COLORS.length]

export default function SelfLifePanel() {
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const imagesById = useGameStore((s) => s.imagesById)
  const { dispatch } = useGameEngine()
  const [matrixOpen, setMatrixOpen] = useState(false)

  const counts = useMemo(() => {
    let lib = 0, gy = 0, exile = 0
    let cmdArt: string | undefined
    if (gameState) {
      for (const c of Object.values(gameState.cards)) {
        if (c.ownerSeat !== mySeat) continue
        if (c.zone === 'library') lib++
        else if (c.zone === 'graveyard') gy++
        else if (c.zone === 'exile') exile++
        else if (c.zone === 'command' && !cmdArt) cmdArt = imagesById[c.cardId ?? '']?.img
      }
    }
    return { lib, gy, exile, cmdArt }
  }, [gameState, mySeat, imagesById])

  const me = gameState?.players[mySeat]
  if (!gameState || !me) return null
  const color = (me as { color?: string }).color || sc(mySeat)
  const adjust = (d: number) => dispatch({ t: 'adjust_life', seat: mySeat, delta: d } as never)

  const step: React.CSSProperties = { width: 26, height: 26, borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center' }

  return (
    <>
      <div
        style={{
          position: 'fixed', top: 52, right: 10, zIndex: 49, width: 178, borderRadius: 'var(--r-lg)',
          overflow: 'hidden', background: 'var(--glass-strong)', backdropFilter: 'blur(14px)',
          border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-md)',
        }}
      >
        {counts.cmdArt && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(' + counts.cmdArt + ')', backgroundSize: 'cover', backgroundPosition: 'center 22%', opacity: 0.16, pointerEvents: 'none' }} />
        )}
        <div style={{ position: 'relative', padding: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-200)', fontWeight: 700, color: 'var(--paper)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.name || ('Seat ' + (mySeat + 1))}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <button style={step} onClick={() => adjust(-1)}>−</button>
            <span style={{ fontSize: 'var(--fs-700)', fontWeight: 700, color: 'var(--paper)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{me.life}</span>
            <button style={step} onClick={() => adjust(1)}>+</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-100)', color: 'var(--muted)', borderTop: '1px solid var(--hairline)', paddingTop: 7 }}>
            <span title="Library">LIB <b style={{ color: 'var(--paper)' }}>{counts.lib}</b></span>
            <span title="Graveyard">GY <b style={{ color: 'var(--paper)' }}>{counts.gy}</b></span>
            <span title="Exile">EX <b style={{ color: 'var(--paper)' }}>{counts.exile}</b></span>
          </div>

          <button
            onClick={() => setMatrixOpen(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 0', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper-dim)', fontSize: 'var(--fs-100)', fontWeight: 600, cursor: 'pointer' }}
          >
            <Swords size={12} /> Commander damage
          </button>
        </div>
      </div>

      {matrixOpen && <CmdMatrix gameState={gameState} mySeat={mySeat} onClose={() => setMatrixOpen(false)} />}
    </>
  )
}

function CmdMatrix({ gameState, mySeat, onClose }: { gameState: GameState; mySeat: number; onClose: () => void }) {
  const { dispatch } = useGameEngine()
  const players = gameState.players
  const apply = (target: number, from: number, d: number) => {
    dispatch({ t: 'commander_damage', seat: target, fromSeat: from, fromCmd: 'primary', delta: d } as never)
    dispatch({ t: 'adjust_life', seat: target, delta: -d } as never)
  }
  const name = (s: number) => players[s]?.name || ('Seat ' + (s + 1))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 85, display: 'grid', placeItems: 'center', background: 'rgba(4,8,16,0.7)', backdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(92vw, 520px)', maxHeight: '82vh', overflow: 'auto', padding: 18, borderRadius: 'var(--r-lg)', background: 'var(--panel-strong)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ fontSize: 'var(--fs-400)', fontWeight: 700, color: 'var(--paper)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Swords size={16} /> Commander damage</h3>
        {players.length < 2 ? (
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-200)' }}>Commander damage tracks damage between players — it applies once there are opponents in the pod.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {players.map((p) => (
              <div key={p.seat} style={{ padding: 10, borderRadius: 'var(--r-md)', background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: sc(p.seat) }} />
                  <span style={{ fontWeight: 700, color: 'var(--paper)' }}>{name(p.seat)}{p.seat === mySeat ? ' (you)' : ''}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 'var(--fs-100)' }}>life {p.life}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {players.filter((o) => o.seat !== p.seat).map((from) => {
                    const dmg = p.cmdDamage[from.seat + ':primary'] ?? 0
                    return (
                      <div key={from.seat} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 7px', borderRadius: 'var(--r-pill)', background: dmg >= 21 ? 'rgba(224,101,92,0.25)' : 'var(--ink-3)', border: '1px solid var(--hairline)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc(from.seat) }} />
                        <button onClick={() => { if (dmg > 0) apply(p.seat, from.seat, -1) }} style={miniBtn}>−</button>
                        <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700, color: dmg >= 21 ? 'var(--danger)' : 'var(--paper)' }}>{dmg}</span>
                        <button onClick={() => apply(p.seat, from.seat, 1)} style={miniBtn}>+</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ marginTop: 14, padding: '8px 18px', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontWeight: 600, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )
}

const miniBtn: React.CSSProperties = { width: 18, height: 18, borderRadius: 'var(--r-xs)', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'var(--paper)', fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 12 }

/**
 * DicePopup — the "Randomizer" popup (vanilla play-hud.js openDice parity).
 * Coin flip (Heads/Tails), Quick roll (d4-d20), Custom (N x dD with sum),
 * a live result line, and the 3D dice/coin overlays for flourish. Logs + broadcasts.
 */
import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { DiceOverlay, type DieSides } from '../dice/Dice3D'
import { CoinOverlay } from '../dice/Coin3D'

const QUICK: DieSides[] = [4, 6, 8, 10, 12, 20]
const CUSTOM_N = [1, 2, 3, 4, 5, 6, 8, 10]
const CUSTOM_D: DieSides[] = [2, 4, 6, 8, 10, 12, 20, 100]

export default function DicePopup({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState('')
  const [flash, setFlash] = useState(0)
  const [diceOverlay, setDiceOverlay] = useState<{ sides: DieSides; result: number } | null>(null)
  const [coinOverlay, setCoinOverlay] = useState<'heads' | 'tails' | null>(null)
  const [customN, setCustomN] = useState(1)
  const [customD, setCustomD] = useState<DieSides>(20)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('click', onDoc); window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onDoc); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const log = (msg: string) => useGameStore.getState().pushLogEntry(msg)
  const broadcast = (payload: Record<string, unknown>) => { const s = useGameStore.getState().onlineSendIntent; if (s) s(payload as never) }
  const show = (txt: string) => { setResult(txt); setFlash((f) => f + 1) }

  function flip() {
    const r: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails'
    show(`Coin → ${r === 'heads' ? 'Heads' : 'Tails'}`)
    setCoinOverlay(r)
    log(`You flipped a coin → ${r}`)
    broadcast({ type: 'diceRoll', kind: 'coin', result: r })
  }
  function quick(sides: DieSides) {
    const r = Math.floor(Math.random() * sides) + 1
    show(`d${sides} → ${r}`)
    setDiceOverlay({ sides, result: r })
    log(`You rolled d${sides} → ${r}`)
    broadcast({ type: 'diceRoll', kind: 'dice', sides, result: r })
  }
  function rollCustom() {
    const rolls: number[] = []
    let sum = 0
    for (let i = 0; i < customN; i++) { const r = Math.floor(Math.random() * customD) + 1; rolls.push(r); sum += r }
    show(`${customN}d${customD} → ${sum}${customN > 1 ? `  (${rolls.join(' + ')})` : ''}`)
    if (customN === 1) setDiceOverlay({ sides: customD, result: rolls[0] }) // 3D overlay only for a single die
    log(`You rolled ${customN}d${customD} → ${sum}${customN > 1 ? ` [${rolls.join(', ')}]` : ''}`)
    broadcast({ type: 'diceRoll', kind: 'dice', sides: customD, result: sum })
  }

  const secH: React.CSSProperties = { fontSize: 'var(--fs-100)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 700, margin: '0 0 6px' }
  const bigBtn: React.CSSProperties = { flex: 1, padding: '8px 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontSize: 'var(--fs-200)', fontWeight: 600, cursor: 'pointer' }
  const dieBtn: React.CSSProperties = { padding: '7px 0', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontSize: 'var(--fs-100)', fontWeight: 700, cursor: 'pointer' }
  const sel: React.CSSProperties = { height: 30, padding: '0 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontSize: 'var(--fs-100)' }

  return (
    <>
      <div
        ref={ref}
        style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 70, width: 264,
          background: 'var(--glass-strong)', backdropFilter: 'blur(16px)', border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 12,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div>
          <p style={secH}>Coin flip</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={bigBtn} onClick={flip}>◯ Heads</button>
            <button style={bigBtn} onClick={flip}>◑ Tails</button>
          </div>
        </div>
        <div>
          <p style={secH}>Quick roll</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
            {QUICK.map((d) => <button key={d} style={dieBtn} onClick={() => quick(d)}>d{d}</button>)}
          </div>
        </div>
        <div>
          <p style={secH}>Custom</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select style={sel} value={customN} onChange={(e) => setCustomN(Number(e.target.value))}>
              {CUSTOM_N.map((n) => <option key={n} value={n} style={{ color: '#000' }}>{n}</option>)}
            </select>
            <span style={{ color: 'var(--muted)' }}>×</span>
            <select style={sel} value={customD} onChange={(e) => setCustomD(Number(e.target.value) as DieSides)}>
              {CUSTOM_D.map((d) => <option key={d} value={d} style={{ color: '#000' }}>d{d}</option>)}
            </select>
            <button style={{ ...dieBtn, flex: 1, background: 'var(--accent)', color: '#04101f' }} onClick={rollCustom}>Roll</button>
          </div>
        </div>
        {result && (
          <div key={flash} style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 'var(--r-sm)', background: 'var(--brand-soft)', color: 'var(--paper)', fontSize: 'var(--fs-300)', fontWeight: 700, animation: 'dicePulse 360ms ease' }} aria-live="polite">
            {result}
          </div>
        )}
        <style>{'@keyframes dicePulse { 0% { transform: scale(0.92); opacity: 0.4 } 100% { transform: scale(1); opacity: 1 } }'}</style>
      </div>
      {diceOverlay && <DiceOverlay key={'d' + flash} sides={diceOverlay.sides} result={diceOverlay.result} onComplete={() => setDiceOverlay(null)} />}
      {coinOverlay && <CoinOverlay key={'c' + flash} result={coinOverlay} onComplete={() => setCoinOverlay(null)} />}
    </>
  )
}

/**
 * Paper Life Tracker — full vanilla parity port (Agent B, #85 + audit gaps).
 * Implements: 24-counter catalog + per-player visibility picker, press-and-hold
 * ±5 auto-repeat (tap = ±1), life floor at 0, per-player commander art + import
 * + smart-counter detection, undo stack, full turn tracker (enable/prev/next,
 * cycles, next player), dead-aware random, dice/coin, table log (copy/clear/count),
 * infect/poison/cmdr death with reason, transient life-change flash. Shared tokens.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Plus, Minus, RotateCcw, Skull, Swords, X, Dices, Shuffle, ScrollText,
  ChevronRight, ChevronLeft, Undo2, Copy, Trash2, SlidersHorizontal,
} from 'lucide-react'
import { getCardByName } from '../lib/scryfall'

const COLORS = ['#e0655c', '#4aa3e6', '#46b277', '#d9a441', '#9b86c4', '#46b5c9']
const DICE = [4, 6, 8, 10, 12, 20, 100] as const

interface CounterType { key: string; label: string; color: string; matches?: string[]; mana?: boolean }
const COUNTER_TYPES: CounterType[] = [
  { key: 'poison', label: 'Poison', color: '#c08cff', matches: ['poison', 'toxic', 'corrupted'] },
  { key: 'infect', label: 'Infect', color: '#b46cff', matches: ['infect'] },
  { key: 'energy', label: 'Energy', color: '#55d7ff', matches: ['energy'] },
  { key: 'experience', label: 'XP', color: '#ffb7e8', matches: ['experience counter'] },
  { key: 'mana_w', label: 'W mana', color: '#f7f3da', mana: true },
  { key: 'mana_u', label: 'U mana', color: '#5aa9e6', mana: true },
  { key: 'mana_b', label: 'B mana', color: '#a193b8', mana: true },
  { key: 'mana_r', label: 'R mana', color: '#e0604f', mana: true },
  { key: 'mana_g', label: 'G mana', color: '#5aa66a', mana: true },
  { key: 'mana_c', label: 'C mana', color: '#c7ccd6', mana: true },
  { key: 'storm', label: 'Storm', color: '#8aa7ff', matches: ['storm', 'magecraft'] },
  { key: 'treasure', label: 'Treasure', color: '#f2b84b', matches: ['treasure token'] },
  { key: 'clue', label: 'Clue', color: '#7bdcff', matches: ['clue token', 'investigate'] },
  { key: 'food', label: 'Food', color: '#d8c189', matches: ['food token'] },
  { key: 'blood', label: 'Blood', color: '#c77dff', matches: ['blood token'] },
  { key: 'map', label: 'Map', color: '#e0d6a7', matches: ['map token'] },
  { key: 'rad', label: 'Rad', color: '#75f0ff', matches: ['rad counter'] },
  { key: 'shield', label: 'Shield', color: '#c6dbff', matches: ['shield counter'] },
  { key: 'oil', label: 'Oil', color: '#9d93ff', matches: ['oil counter'] },
  { key: 'charge', label: 'Charge', color: '#ffd166', matches: ['charge counter'] },
  { key: 'loyalty', label: 'Loyalty', color: '#e8ecff', matches: ['planeswalker', 'loyalty counter'] },
  { key: 'monarch', label: 'Monarch', color: '#ffe08a', matches: ['the monarch'] },
  { key: 'initiative', label: 'Initiative', color: '#ffb86b', matches: ['the initiative'] },
]
const DEATH_AT: Record<string, number> = { poison: 10, infect: 10 }

interface Commander { name: string; art?: string }
interface Player {
  id: number; name: string; life: number; color: string
  commander?: Commander
  cmdDmg: Record<number, number>
  cmdTax: number
  counters: Record<string, number>
  visible: string[]
}
interface LogEntry { id: number; text: string }
interface Snapshot { players: Player[]; turn: number; activeSeat: number }

function makePlayers(count: number, life: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i, name: `Player ${i + 1}`, life, color: COLORS[i % COLORS.length],
    cmdDmg: {}, cmdTax: 0, counters: {}, visible: ['poison'],
  }))
}
function deathReason(p: Player): string | null {
  if (p.life <= 0) return 'life'
  if ((p.counters['poison'] ?? 0) >= 10) return 'poison'
  if ((p.counters['infect'] ?? 0) >= 10) return 'infect'
  if (Object.values(p.cmdDmg).some((d) => d >= 21)) return 'commander damage'
  return null
}
let logSeq = 1

export default function LifeTracker() {
  const [startingLife, setStartingLife] = useState(40)
  const [count, setCount] = useState(4)
  const [players, setPlayers] = useState<Player[]>(() => makePlayers(4, 40))
  const [layout, setLayout] = useState<'auto' | 'duel' | 'grid'>('auto')
  const [cmdOpen, setCmdOpen] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState<number | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [roll, setRoll] = useState('—')
  const [rolling, setRolling] = useState(false)
  const [activeSeat, setActiveSeat] = useState(0)
  const [turn, setTurn] = useState(1)
  const [turnEnabled, setTurnEnabled] = useState(true)
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [flash, setFlash] = useState<Record<number, { delta: number; up: boolean }>>({})
  const flashTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  // Per-pointer hold timers — multi-touch safe (never share one ref across buttons).
  type HoldState = { to?: ReturnType<typeof setTimeout>; iv?: ReturnType<typeof setInterval>; held: boolean }
  const holdMap = useRef<Map<number, HoldState>>(new Map())
  // Live mirrors of state so timers/snapshots read fresh values (no stale closures).
  const playersRef = useRef(players); playersRef.current = players
  const turnRef = useRef(turn); turnRef.current = turn
  const activeSeatRef = useRef(activeSeat); activeSeatRef.current = activeSeat
  const undoStackRef = useRef(undoStack); undoStackRef.current = undoStack

  const addLog = useCallback((text: string) => setLog((l) => [{ id: logSeq++, text }, ...l].slice(0, 80)), [])
  const snapshot = useCallback(() => {
    setUndoStack((s) => [...s.slice(-29), { players: JSON.parse(JSON.stringify(playersRef.current)), turn: turnRef.current, activeSeat: activeSeatRef.current }])
  }, [])
  const undo = useCallback(() => {
    const stack = undoStackRef.current
    if (!stack.length) return
    const prev = stack[stack.length - 1]
    setUndoStack((s) => s.slice(0, -1)) // pure updater
    setPlayers(prev.players); setTurn(prev.turn); setActiveSeat(prev.activeSeat)
    addLog('Undo')
  }, [addLog])

  const clearTimers = useCallback(() => {
    holdMap.current.forEach((st) => { if (st.to) clearTimeout(st.to); if (st.iv) clearInterval(st.iv) })
    holdMap.current.clear()
    Object.values(flashTimers.current).forEach((t) => clearTimeout(t)); flashTimers.current = {}
  }, [])
  useEffect(() => clearTimers, [clearTimers]) // tear down timers on unmount

  function newGame(c: number, life: number) {
    clearTimers()
    setCount(c); setStartingLife(life); setPlayers(makePlayers(c, life))
    setCmdOpen(null); setPickerOpen(null); setImportOpen(null)
    setActiveSeat(0); setTurn(1); setLog([]); setUndoStack([]); setFlash({})
  }

  const showFlash = useCallback((id: number, delta: number) => {
    setFlash((fl) => {
      const cur = fl[id]?.delta ?? 0
      const next = (Math.sign(cur) === Math.sign(delta) ? cur : 0) + delta
      return { ...fl, [id]: { delta: next, up: next >= 0 } }
    })
    if (flashTimers.current[id]) clearTimeout(flashTimers.current[id])
    flashTimers.current[id] = setTimeout(() => setFlash((fl) => { const n = { ...fl }; delete n[id]; return n }), 1300)
  }, [])

  const adjustLife = useCallback((id: number, delta: number) => {
    const cur = playersRef.current.find((p) => p.id === id)
    if (!cur) return
    const life = Math.max(0, cur.life + delta)
    const realized = life - cur.life
    if (realized === 0) return // clamped at 0 — no change, so no snapshot/log/flash
    snapshot()
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, life } : p)))
    addLog(`${cur.name} ${realized > 0 ? '+' : ''}${realized} life (→ ${life})`)
    showFlash(id, realized)
  }, [snapshot, addLog, showFlash])

  // tap = ±1, hold = repeating ±5
  const makeHold = (id: number, dir: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* ignore */ }
      const st: HoldState = { held: false }
      holdMap.current.set(e.pointerId, st)
      st.to = setTimeout(() => {
        st.held = true
        adjustLife(id, dir * 5)
        st.iv = setInterval(() => adjustLife(id, dir * 5), 600)
      }, 420)
    },
    onPointerUp: (e: React.PointerEvent) => {
      const st = holdMap.current.get(e.pointerId)
      if (!st) return
      if (st.to) clearTimeout(st.to)
      if (st.iv) clearInterval(st.iv)
      if (!st.held) adjustLife(id, dir)
      holdMap.current.delete(e.pointerId)
    },
    onPointerLeave: (e: React.PointerEvent) => {
      const st = holdMap.current.get(e.pointerId)
      if (!st) return
      if (st.to) clearTimeout(st.to)
      if (st.iv) clearInterval(st.iv)
      holdMap.current.delete(e.pointerId)
    },
  })

  const adjustCounter = useCallback((id: number, key: string, d: number) => {
    snapshot()
    setPlayers((ps) => ps.map((p) => p.id === id ? { ...p, counters: { ...p.counters, [key]: Math.max(0, (p.counters[key] ?? 0) + d) } } : p))
  }, [snapshot])
  const toggleVisible = useCallback((id: number, key: string) => {
    setPlayers((ps) => ps.map((p) => p.id === id ? { ...p, visible: p.visible.includes(key) ? p.visible.filter((k) => k !== key) : [...p.visible, key] } : p))
  }, [])
  const adjustTax = useCallback((id: number, d: number) => {
    snapshot()
    setPlayers((ps) => ps.map((p) => p.id === id ? { ...p, cmdTax: Math.max(0, p.cmdTax + d) } : p))
  }, [snapshot])
  const adjustCmd = useCallback((targetId: number, fromId: number, d: number) => {
    snapshot()
    setPlayers((ps) => ps.map((p) => {
      if (p.id !== targetId) return p
      const cur = p.cmdDmg[fromId] ?? 0
      const next = Math.max(0, cur + d)
      // Increasing commander damage costs life (capped at current life so it can't go negative);
      // decreasing is a counter-only correction and does NOT restore life (life was clamped at 0).
      const lifeLoss = d > 0 ? Math.min(p.life, next - cur) : 0
      return { ...p, cmdDmg: { ...p.cmdDmg, [fromId]: next }, life: Math.max(0, p.life - lifeLoss) }
    }))
  }, [snapshot])
  const rename = useCallback((id: number, name: string) => setPlayers((ps) => ps.map((p) => p.id === id ? { ...p, name } : p)), [])
  const cycleColor = useCallback((id: number) => setPlayers((ps) => ps.map((p) => p.id === id ? { ...p, color: COLORS[(COLORS.indexOf(p.color) + 1) % COLORS.length] } : p)), [])

  // Per-player commander import → art background + smart counters
  async function setCommander(id: number, rawName: string) {
    const name = rawName.trim()
    setImportOpen(null)
    if (!name) { setPlayers((ps) => ps.map((p) => p.id === id ? { ...p, commander: undefined } : p)); return }
    if (playersRef.current.find((p) => p.id === id)?.commander?.name === name) return // unchanged — avoid duplicate fetch/log
    setPlayers((ps) => ps.map((p) => p.id === id ? { ...p, name, commander: { name } } : p))
    try {
      const card = await getCardByName(name)
      if (!card) return
      const face = card.card_faces?.[0] ?? card
      const art = face.image_uris?.art_crop ?? card.image_uris?.art_crop
      const text = `${card.type_line ?? ''} ${card.oracle_text ?? ''} ${card.card_faces?.map((fc) => `${fc.type_line ?? ''} ${fc.oracle_text ?? ''}`).join(' ') ?? ''}`.toLowerCase()
      const smart = COUNTER_TYPES.filter((c) => c.matches?.some((m) => text.includes(m))).map((c) => c.key)
      setPlayers((ps) => ps.map((p) => p.id === id ? {
        ...p, commander: { name: card.name, art },
        visible: Array.from(new Set([...p.visible, ...smart])),
      } : p))
      addLog(`${name}: commander set${smart.length ? ` (smart counters: ${smart.join(', ')})` : ''}`)
    } catch { /* offline / not found — keep name only */ }
  }

  function rollDie(s: number) {
    setRolling(true)
    setTimeout(() => { const r = Math.floor(Math.random() * s) + 1; setRoll(`d${s}: ${r}`); setRolling(false); addLog(`Rolled d${s} → ${r}`) }, 280)
  }
  function flipCoin() {
    setRolling(true)
    setTimeout(() => { const r = Math.random() < 0.5 ? 'Heads' : 'Tails'; setRoll(`Coin: ${r}`); setRolling(false); addLog(`Coin → ${r}`) }, 280)
  }
  function randomPlayer() {
    snapshot()
    const alive = players.filter((p) => !deathReason(p))
    const pool = alive.length ? alive : players
    const pick = pool[Math.floor(Math.random() * pool.length)]
    setRoll(`★ ${pick.name}`); addLog(`Random player → ${pick.name}`); setActiveSeat(pick.id)
  }
  function passTurn() {
    if (!turnEnabled) return
    snapshot()
    const n = (activeSeat + 1) % players.length
    setActiveSeat(n); if (n === 0) setTurn((t) => t + 1); addLog(`Turn → ${players[n].name}`)
  }
  function prevTurn() {
    if (!turnEnabled) return
    snapshot()
    const n = (activeSeat - 1 + players.length) % players.length
    setActiveSeat(n); if (activeSeat === 0) setTurn((t) => Math.max(1, t - 1)); addLog(`Prev turn → ${players[n].name}`)
  }
  function copyLog() {
    const text = log.map((e) => e.text).reverse().join('\n')
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {})
  }

  const cols = layout === 'duel' ? 2 : layout === 'grid' ? 3 : (players.length <= 2 ? 2 : players.length <= 4 ? 2 : 3)
  const cycles = turn - 1
  const tokenBtn = (active: boolean): React.CSSProperties => ({ background: active ? 'var(--paper)' : 'transparent', color: active ? 'var(--ink)' : 'var(--paper)', border: '1px solid var(--hairline)' })

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 py-5" style={{ background: 'var(--bg)', color: 'var(--paper)' }}>
      {/* Setup bar */}
      <div className="max-w-6xl mx-auto mb-4 flex flex-wrap items-center gap-3 rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-1.5"><span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Players</span>
          {[2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => newGame(n, startingLife)} className="w-7 h-7 rounded-md text-sm font-semibold" style={tokenBtn(n === count)}>{n}</button>)}
        </div>
        <div className="flex items-center gap-1.5"><span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Life</span>
          <button onClick={() => newGame(count, Math.max(1, startingLife - 1))} className="w-7 h-7 rounded-md font-bold" style={tokenBtn(false)}>−</button>
          <input type="number" value={startingLife} onChange={(e) => { const v = Math.max(1, Math.min(999, Number(e.target.value) || 1)); newGame(count, v) }} className="w-14 h-7 text-center rounded-md bg-transparent font-bold tabular-nums" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }} />
          <button onClick={() => newGame(count, startingLife + 1)} className="w-7 h-7 rounded-md font-bold" style={tokenBtn(false)}>+</button>
          <button onClick={() => newGame(count, 20)} className="px-2.5 h-7 rounded-md text-xs font-semibold" style={tokenBtn(startingLife === 20)}>Standard</button>
          <button onClick={() => newGame(count, 40)} className="px-2.5 h-7 rounded-md text-xs font-semibold" style={tokenBtn(startingLife === 40)}>Commander</button>
        </div>
        <div className="flex items-center gap-1.5"><span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Layout</span>
          {([['auto', 'Auto'], ['duel', '2×2'], ['grid', '3×3']] as const).map(([k, l]) => <button key={k} onClick={() => setLayout(k)} className="px-2.5 h-7 rounded-md text-xs font-semibold" style={tokenBtn(layout === k)}>{l}</button>)}
        </div>
        <a href="https://magic.wizards.com/en/rules" target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: 'var(--muted)' }}>Rules</a>
        <button onClick={() => newGame(count, startingLife)} className="ml-auto inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-semibold" style={{ background: 'var(--accent)', color: '#04101f' }}><RotateCcw size={14} /> New game</button>
      </div>

      {/* Tools bar */}
      <div className="max-w-6xl mx-auto mb-4 flex flex-wrap items-center gap-2 rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
        <Dices size={16} style={{ color: 'var(--muted)' }} />
        {DICE.map((d) => <button key={d} onClick={() => rollDie(d)} className="px-2 h-7 rounded-md text-xs font-semibold" style={tokenBtn(false)}>d{d}</button>)}
        <button onClick={flipCoin} className="px-2 h-7 rounded-md text-xs font-semibold" style={tokenBtn(false)}>Coin</button>
        <button onClick={randomPlayer} className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-xs font-semibold" style={tokenBtn(false)}><Shuffle size={12} /> Random</button>
        <span className="px-3 h-7 inline-flex items-center rounded-md text-xs font-bold" style={{ background: 'var(--brand-soft)', color: 'var(--brand-bright)', minWidth: 96, justifyContent: 'center', opacity: rolling ? 0.5 : 1 }}>{rolling ? '…' : roll}</span>
        <div className="mx-1 h-6 w-px" style={{ background: 'var(--hairline)' }} />
        <label className="inline-flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--muted)' }}><input type="checkbox" checked={turnEnabled} onChange={(e) => setTurnEnabled(e.target.checked)} /> Turns</label>
        <button onClick={prevTurn} disabled={!turnEnabled} className="inline-flex items-center px-1.5 h-7 rounded-md text-xs font-semibold disabled:opacity-40" style={tokenBtn(false)}><ChevronLeft size={13} /></button>
        <button onClick={passTurn} disabled={!turnEnabled} className="inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-semibold disabled:opacity-40" style={tokenBtn(false)}>Pass <ChevronRight size={12} /></button>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Turn {turn} · Cycles {cycles} · {players[activeSeat]?.name}</span>
        <button onClick={undo} disabled={!undoStack.length} className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-xs font-semibold disabled:opacity-40" style={tokenBtn(false)}><Undo2 size={12} /> Undo</button>
        <button onClick={() => setLogOpen((o) => !o)} className="ml-auto inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-semibold" style={tokenBtn(logOpen)}><ScrollText size={13} /> Log {log.length ? `(${log.length})` : ''}</button>
      </div>

      <div className="max-w-6xl mx-auto flex gap-4">
        <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {players.map((p) => {
            const reason = deathReason(p)
            const active = p.id === activeSeat
            const f = flash[p.id]
            return (
              <div key={p.id} className="relative rounded-2xl overflow-hidden flex flex-col"
                style={{ background: `linear-gradient(165deg, ${p.color}22, var(--panel) 70%)`, border: `2px solid ${active ? p.color : p.color + '88'}`, boxShadow: active ? `0 0 0 2px ${p.color}55, var(--shadow-md)` : 'var(--shadow-sm)', opacity: reason ? 0.62 : 1 }}>
                {p.commander?.art && <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${p.commander.art})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.18 }} />}
                {reason && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none" style={{ background: 'rgba(4,10,20,0.66)' }}><Skull size={42} style={{ color: 'var(--danger)' }} /><strong className="mt-1 text-base" style={{ color: 'var(--danger)' }}>DEAD</strong><span className="text-[11px]" style={{ color: 'var(--muted)' }}>{reason}</span></div>}

                <div className="relative z-10 flex items-center gap-2 px-3 pt-3">
                  <button onClick={() => cycleColor(p.id)} className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: p.color }} aria-label="Change color" />
                  <input value={p.name} onChange={(e) => rename(p.id, e.target.value)} className="flex-1 bg-transparent text-base font-bold outline-none min-w-0" style={{ color: p.color }} />
                  <button onClick={() => setImportOpen(importOpen === p.id ? null : p.id)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }} title="Set commander / deck art">⚔ Cmdr</button>
                </div>
                {p.commander?.name && importOpen !== p.id && <div className="relative z-10 px-3 text-[11px] truncate" style={{ color: 'var(--muted)' }}>{p.commander.name}</div>}
                {importOpen === p.id && (
                  <div className="relative z-10 px-3 pt-1">
                    <input autoFocus defaultValue={p.commander?.name ?? ''} placeholder="Commander name…" onKeyDown={(e) => { if (e.key === 'Enter') setCommander(p.id, (e.target as HTMLInputElement).value) }} onBlur={(e) => setCommander(p.id, e.target.value)} className="w-full h-7 px-2 rounded text-xs bg-transparent" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }} />
                  </div>
                )}

                {/* big life with large colored +/- blocks (press-and-hold = ±5) */}
                <div className="relative z-10 flex items-stretch mt-2" style={{ height: 104 }}>
                  <button {...makeHold(p.id, -1)} className="w-16 grid place-items-center font-black select-none" style={{ background: `${p.color}33`, color: p.color }} aria-label="Lose life"><Minus size={26} /></button>
                  <div className="flex-1 grid place-items-center relative">
                    <span className="text-6xl font-black tabular-nums transition-transform" style={{ color: p.life <= 5 ? 'var(--danger)' : 'var(--paper)', transform: f ? 'scale(1.08)' : 'scale(1)' }}>{p.life}</span>
                    {f && <span className="absolute top-1 right-2 text-sm font-bold" style={{ color: f.up ? 'var(--success)' : 'var(--danger)' }}>{f.up ? '+' : ''}{f.delta}</span>}
                  </div>
                  <button {...makeHold(p.id, 1)} className="w-16 grid place-items-center font-black select-none" style={{ background: `${p.color}33`, color: p.color }} aria-label="Gain life"><Plus size={26} /></button>
                </div>

                <div className="relative z-10 px-3 py-2 flex flex-col gap-2">
                  {/* visible counters as chips */}
                  {p.visible.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.visible.map((key) => { const ct = COUNTER_TYPES.find((c) => c.key === key); if (!ct) return null; const v = p.counters[key] ?? 0; const dead = DEATH_AT[key] && v >= DEATH_AT[key]
                        return (
                          <div key={key} className="inline-flex items-center gap-1 px-1.5 h-6 rounded text-[11px] font-semibold" style={{ background: `${ct.color}22`, color: dead ? 'var(--danger)' : ct.color, border: `1px solid ${ct.color}44` }} title={ct.label}>
                            <button onClick={() => adjustCounter(p.id, key, -1)} className="leading-none">−</button>
                            <span className="tabular-nums">{ct.label.split(' ')[0]} {v}</span>
                            <button onClick={() => adjustCounter(p.id, key, 1)} className="leading-none">+</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCmdOpen(cmdOpen === p.id ? null : p.id)} className="flex-1 h-9 rounded-md inline-flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ background: 'var(--brand-soft)', color: 'var(--brand-bright)', border: `1px solid ${p.color}55` }}><Swords size={13} /> Cmdr dmg</button>
                    <button onClick={() => setPickerOpen(pickerOpen === p.id ? null : p.id)} className="h-9 px-2.5 rounded-md inline-flex items-center gap-1 text-xs font-semibold" style={{ border: '1px solid var(--hairline)', background: pickerOpen === p.id ? 'var(--hairline)' : 'transparent' }} title="More counters"><SlidersHorizontal size={13} /></button>
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
                    <span>Cmdr tax</span>
                    <div className="flex items-center gap-1.5"><button onClick={() => adjustTax(p.id, -2)} className="w-6 h-6 rounded grid place-items-center" style={{ border: '1px solid var(--hairline)' }}>−</button><span className="font-bold tabular-nums min-w-[2ch] text-center" style={{ color: 'var(--paper)' }}>{p.cmdTax}</span><button onClick={() => adjustTax(p.id, 2)} className="w-6 h-6 rounded grid place-items-center" style={{ border: '1px solid var(--hairline)' }}>+</button></div>
                  </div>

                  {pickerOpen === p.id && (
                    <div className="rounded-lg p-2.5" style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
                      <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>Counters — tap to show/hide</span><button onClick={() => setPickerOpen(null)}><X size={13} /></button></div>
                      <div className="flex flex-wrap gap-1">
                        {COUNTER_TYPES.map((ct) => { const on = p.visible.includes(ct.key); return (
                          <button key={ct.key} onClick={() => toggleVisible(p.id, ct.key)} className="px-1.5 h-6 rounded text-[11px] font-semibold" style={{ background: on ? `${ct.color}33` : 'transparent', color: on ? ct.color : 'var(--muted)', border: `1px solid ${on ? ct.color + '66' : 'var(--hairline)'}` }}>{ct.label}</button>
                        )})}
                      </div>
                    </div>
                  )}
                  {cmdOpen === p.id && (
                    <div className="rounded-lg p-2.5" style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
                      <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>Commander damage (21 = death)</span><button onClick={() => setCmdOpen(null)}><X size={13} /></button></div>
                      {players.filter((o) => o.id !== p.id).map((o) => { const dmg = p.cmdDmg[o.id] ?? 0; return (
                        <div key={o.id} className="flex items-center justify-between gap-2 text-sm py-0.5">
                          <span className="truncate" style={{ color: o.color }}>{o.commander?.name ?? o.name}</span>
                          <div className="flex items-center gap-1.5"><button onClick={() => adjustCmd(p.id, o.id, -1)} className="w-5 h-5 rounded grid place-items-center" style={{ border: '1px solid var(--hairline)' }}>−</button><span className="font-bold tabular-nums min-w-[2ch] text-center" style={{ color: dmg >= 21 ? 'var(--danger)' : 'var(--paper)' }}>{dmg}</span><button onClick={() => adjustCmd(p.id, o.id, 1)} className="w-5 h-5 rounded grid place-items-center" style={{ border: '1px solid var(--hairline)' }}>+</button></div>
                        </div>
                      )})}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {logOpen && (
          <div className="w-64 flex-shrink-0 rounded-xl p-3 self-start" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Table log ({log.length})</span>
              <div className="flex gap-1">
                <button onClick={copyLog} title="Copy" className="p-1 rounded" style={{ border: '1px solid var(--hairline)' }}><Copy size={11} /></button>
                <button onClick={() => setLog([])} title="Clear" className="p-1 rounded" style={{ border: '1px solid var(--hairline)' }}><Trash2 size={11} /></button>
              </div>
            </div>
            {log.length === 0 && <div className="text-xs" style={{ color: 'var(--faint)' }}>No actions yet.</div>}
            {log.map((e) => <div key={e.id} className="text-xs py-0.5" style={{ color: 'var(--paper-dim)' }}>{e.text}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}

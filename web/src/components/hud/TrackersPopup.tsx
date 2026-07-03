/**
 * TrackersPopup — per-player counter trackers (vanilla play-hud.js openTrackers parity).
 * Tap a pill to enable/disable a tracker (persisted to localStorage); enabled trackers
 * show a -/value/+ row that adjusts gameState.players[mySeat].counters via player_counter.
 * Custom trackers can be added.
 */
import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

const CATALOG: { k: string; l: string }[] = [
  { k: 'poison', l: 'Poison' }, { k: 'energy', l: 'Energy' }, { k: 'experience', l: 'XP' },
  { k: 'storm', l: 'Storm' }, { k: 'treasure', l: 'Treasure' }, { k: 'clue', l: 'Clue' },
  { k: 'food', l: 'Food' }, { k: 'blood', l: 'Blood' }, { k: 'oil', l: 'Oil' },
  { k: 'rad', l: 'Rad' }, { k: 'shield', l: 'Shield' }, { k: 'charge', l: 'Charge' },
  { k: 'loyalty', l: 'Loyalty' }, { k: 'monarch', l: 'Monarch' }, { k: 'initiative', l: 'Initiative' },
  { k: 'ticket', l: 'Ticket' }, { k: 'gold', l: 'Gold' }, { k: 'mana', l: 'Mana' },
]
const DEFAULT_ON = ['poison', 'energy', 'experience']
const LS_KEY = 'sigil_play_trackers'
const LS_CUSTOM = 'sigil_play_trackers_custom'

function load<T>(key: string, fallback: T): T {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(v) ? (v as T) : fallback } catch { return fallback }
}

export default function TrackersPopup({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const { dispatch } = useGameEngine()
  const [enabled, setEnabled] = useState<string[]>(() => load(LS_KEY, DEFAULT_ON.slice()))
  const [custom, setCustom] = useState<{ k: string; l: string }[]>(() => load(LS_CUSTOM, []))
  const [newName, setNewName] = useState('')

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('click', onDoc); window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onDoc); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const persistEnabled = (a: string[]) => { setEnabled(a); try { localStorage.setItem(LS_KEY, JSON.stringify(a)) } catch { /* */ } }
  const persistCustom = (a: { k: string; l: string }[]) => { setCustom(a); try { localStorage.setItem(LS_CUSTOM, JSON.stringify(a)) } catch { /* */ } }

  const all = [...CATALOG, ...custom]
  const counters = gameState?.players[mySeat]?.counters ?? {}

  const toggle = (k: string) => persistEnabled(enabled.includes(k) ? enabled.filter((x) => x !== k) : [...enabled, k])
  const bump = (k: string, delta: number) => dispatch({ t: 'player_counter', seat: mySeat, kind: k, delta } as never)
  const addCustom = () => {
    const name = newName.trim(); if (!name) return
    const k = name.toLowerCase().replace(/\s+/g, '_')
    if (!all.some((t) => t.k === k)) persistCustom([...custom, { k, l: name }])
    persistEnabled(enabled.includes(k) ? enabled : [...enabled, k])
    setNewName('')
  }

  const label = (k: string) => all.find((t) => t.k === k)?.l ?? k
  const pill: React.CSSProperties = { padding: '5px 9px', borderRadius: 'var(--r-pill)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--muted)', fontSize: 'var(--fs-100)', fontWeight: 600, cursor: 'pointer' }
  const adj: React.CSSProperties = { width: 22, height: 22, borderRadius: 'var(--r-xs)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center' }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 70, width: 280,
        background: 'var(--glass-strong)', backdropFilter: 'blur(16px)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <p style={{ fontSize: 'var(--fs-100)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 700, margin: 0 }}>Trackers</p>

      {/* Enabled trackers with -/value/+ */}
      {enabled.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {enabled.map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 1, fontSize: 'var(--fs-200)', color: 'var(--paper)', fontWeight: 600 }}>{label(k)}</span>
              <button style={adj} onClick={() => bump(k, -1)}>−</button>
              <span style={{ minWidth: 26, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--paper)' }}>{counters[k] ?? 0}</span>
              <button style={adj} onClick={() => bump(k, 1)}>+</button>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-100)', color: 'var(--faint)', margin: 0 }}>Tap to enable / disable</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {all.map((t) => (
          <button key={t.k} onClick={() => toggle(t.k)} style={enabled.includes(t.k) ? { ...pill, background: 'var(--brand-soft)', color: 'var(--brand-bright)', borderColor: 'rgba(77,163,255,0.4)' } : pill}>{t.l}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
          placeholder="Add your own tracker…"
          maxLength={28}
          style={{ flex: 1, height: 30, padding: '0 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontSize: 'var(--fs-100)' }}
        />
        <button onClick={addCustom} style={{ ...adj, width: 'auto', padding: '0 12px', background: 'var(--accent)', color: '#04101f' }}>Add</button>
      </div>
    </div>
  )
}

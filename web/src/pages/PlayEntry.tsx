/**
 * PlayEntry — the pre-game flow (vanilla play-shell.js parity):
 * mode-select (Commander / Draft / Planechase / 20 Life) -> deck panel
 * (Solo/Online, Sample Krenko, paste import). On Play it seeds pendingDeck
 * and flips playStarted so the table mounts.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, BookOpen, Play } from 'lucide-react'
import { useGameStore, type PendingDeck } from '../store/gameStore'

const MODES = [
  { key: 'commander', title: 'Commander', sub: '40 life, command zone', c1: '#6d36c4', c2: '#3a1a73' },
  { key: 'draft', title: 'Draft Commander', sub: 'Pick a commander and draft synergies in real time', c1: '#c4631a', c2: '#7a3a0e', badge: 'Beta', disabled: true },
  { key: 'planechase', title: 'Planechase', sub: 'Commander rules plus a shared planar deck and the die', c1: '#1c7a52', c2: '#0e3f2b', badge: 'Soon', disabled: true },
  { key: 'standard', title: '20 Life', sub: 'Standard, Modern, and other 20-life formats', c1: '#2a5bd0', c2: '#173a8f', badge: 'Soon', disabled: true },
]
const COLORS = ['#4f7bf0', '#e0556e', '#3fb27f', '#d7a13a', '#9b5de5', '#46c2d8']

function parseDecklist(text: string): PendingDeck {
  const cards: { name: string; qty: number; isCommander?: boolean }[] = []
  let section: 'main' | 'commander' | 'skip' = 'main'
  for (const raw of text.split(String.fromCharCode(10))) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('#')) continue
    if (/^commanders?(\s*\(\d+\))?$/i.test(line)) { section = 'commander'; continue }
    if (/^(deck|mainboard)(\s*\(\d+\))?$/i.test(line)) { section = 'main'; continue }
    if (/^(sideboard|maybeboard|considering)(\s*\(\d+\))?$/i.test(line)) { section = 'skip'; continue }
    if (section === 'skip') continue
    const m = line.match(/^(\d+)?\s*[xX]?\s+?(.+)$/) || line.match(/^(.+)$/)
    if (!m) continue
    const qty = /^\d/.test(line) ? parseInt(line) : 1
    const isCmdTag = /\*CMDR\*/i.test(line)
    let name = (m[2] ?? m[1]).trim()
    let prev = ''
    while (prev !== name) { prev = name; name = name.replace(/\s*\*[^*]*\*\s*$/, '').replace(/\s*\([^)]*\)\s*[0-9A-Za-z*-]*\s*$/, '').trim() }
    if (!name) continue
    cards.push({ name, qty, isCommander: section === 'commander' || isCmdTag })
  }
  if (cards.length && !cards.some((c) => c.isCommander)) cards[0].isCommander = true
  return { name: 'Imported deck', cards }
}

export default function PlayEntry() {
  const navigate = useNavigate()
  const setPlayStarted = useGameStore((s) => s.setPlayStarted)
  const setPendingDeck = useGameStore((s) => s.setPendingDeck)
  const [step, setStep] = useState<'mode' | 'deck'>('mode')
  const [name, setName] = useState(() => 'Player ' + Math.floor(100 + Math.random() * 900))
  const [color, setColor] = useState(COLORS[0])
  const [online, setOnline] = useState(false)
  const [paste, setPaste] = useState('')

  const launch = (deck: PendingDeck | null) => { setPendingDeck(deck); setPlayStarted(true) }
  const importPlay = () => { const d = parseDecklist(paste); if (d.cards.length) launch(d) }

  // mode-select screen
  if (step === 'mode') {
    return (
      <div style={screenStyle}>
        <div style={{ position: 'absolute', top: 14, left: 14 }}>
          <button onClick={() => navigate('/')} style={backStyle}>&lsaquo; Back to app</button>
        </div>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-200)', letterSpacing: '0.04em' }}>A free multiplayer tabletop for Magic: The Gathering</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', maxWidth: 360 }}>
            <button onClick={() => setColor(COLORS[(COLORS.indexOf(color) + 1) % COLORS.length])} title="Change your color" style={{ width: 36, height: 36, borderRadius: '50%', background: color, border: '2px solid var(--hairline)', cursor: 'pointer', flexShrink: 0 }} />
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" style={{ flex: 1, height: 40, padding: '0 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--paper)', fontSize: 'var(--fs-300)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, width: '100%' }}>
            {MODES.map((m) => (
              <button
                key={m.key}
                disabled={m.disabled}
                onClick={() => { if (!m.disabled) setStep('deck') }}
                style={{
                  position: 'relative', textAlign: 'left', padding: '16px 16px 18px', borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--hairline)', background: 'linear-gradient(150deg, ' + m.c1 + ', ' + m.c2 + ')',
                  color: '#fff', cursor: m.disabled ? 'not-allowed' : 'pointer', opacity: m.disabled ? 0.5 : 1,
                  minHeight: 96, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden',
                }}
              >
                <span style={{ position: 'absolute', top: 12, right: 14, fontSize: 20, opacity: 0.7 }}>&rsaquo;</span>
                <span style={{ fontSize: 'var(--fs-400)', fontWeight: 700 }}>
                  {m.title}{m.badge && <em style={{ marginLeft: 7, fontSize: 'var(--fs-100)', fontStyle: 'normal', padding: '2px 6px', borderRadius: 'var(--r-pill)', background: 'rgba(0,0,0,0.35)', verticalAlign: 'middle' }}>{m.badge}</em>}
                </span>
                <span style={{ fontSize: 'var(--fs-200)', opacity: 0.85, lineHeight: 1.35 }}>{m.sub}</span>
              </button>
            ))}
          </div>
          <p style={{ color: 'var(--faint)', fontSize: 'var(--fs-100)' }}>Solo or online &mdash; plays in your browser, nothing to install.</p>
        </div>
      </div>
    )
  }

  // deck panel
  return (
    <div style={screenStyle}>
      <div style={{ position: 'absolute', top: 14, left: 14 }}>
        <button onClick={() => setStep('mode')} style={backStyle}><ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> Back</button>
      </div>
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 'var(--fs-500)', fontWeight: 700, color: 'var(--paper)', textAlign: 'center' }}>Choose your deck</h2>

        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 'var(--r-pill)', background: 'var(--ink-3)', border: '1px solid var(--hairline)' }}>
          {(['Solo', 'Online'] as const).map((m, i) => {
            const active = online === (i === 1)
            return <button key={m} onClick={() => setOnline(i === 1)} style={{ flex: 1, padding: '7px 0', borderRadius: 'var(--r-pill)', border: 'none', background: active ? 'var(--brand)' : 'transparent', color: active ? '#04101f' : 'var(--muted)', fontWeight: 700, cursor: 'pointer' }}>{m}</button>
          })}
        </div>

        {online ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 'var(--r-lg)', background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
            <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-200)' }}>Have an invite code? Paste it to join a friend&rsquo;s game, or browse open games.</p>
            <button onClick={() => navigate('/lobby')} style={primaryBtn}>Go to multiplayer lobby &rsaquo;</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 'var(--r-lg)', background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--paper)', fontWeight: 700 }}>Sample deck &mdash; Krenko Goblins</p>
                <p style={{ color: 'var(--faint)', fontSize: 'var(--fs-100)' }}>A ready-to-play mono-red Commander deck</p>
              </div>
              <button onClick={() => launch(null)} style={primaryBtn}><Play size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Play &rsaquo;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 'var(--r-lg)', background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-200)', display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={13} /> Import from Moxfield / Archidekt / MTGA &mdash; paste a decklist</p>
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'1 Krenko, Mob Boss\n1 Sol Ring\n30 Mountain\n...'} rows={5} style={{ resize: 'vertical', padding: 10, borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)', background: 'var(--ink-3)', color: 'var(--paper)', fontSize: 'var(--fs-100)', fontFamily: 'var(--font-mono)' }} />
              <button onClick={importPlay} disabled={!paste.trim()} style={{ ...primaryBtn, opacity: paste.trim() ? 1 : 0.5 }}>Import &amp; Play &rsaquo;</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const screenStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, background: 'radial-gradient(1200px 600px at 50% -10%, #1a2236, var(--ink-1) 70%)', overflowY: 'auto',
}
const backStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--ink-2)', color: 'var(--muted)', fontSize: 'var(--fs-200)', cursor: 'pointer' }
const primaryBtn: React.CSSProperties = { padding: '9px 16px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--brand)', color: '#04101f', fontWeight: 700, fontSize: 'var(--fs-200)', cursor: 'pointer', whiteSpace: 'nowrap' }

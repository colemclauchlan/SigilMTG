/**
 * ActionLog — toggleable floating log of game actions. (§45, §59)
 *
 * §59: Card hyperlinks — any log string segment `[card:Name]` or `[[Name]]`
 * is rendered as a CardHyperlink component (hover preview, click inspect).
 * The server can embed [card:Sol Ring] tokens in its log lines; plain text
 * also works (hyperlinks only show on hover-image if the card is in cache).
 */
import { useEffect, useRef, Fragment } from 'react'
import { useGameStore } from '../../store/gameStore'
import FloatingPanel from '../panels/FloatingPanel'
import CardHyperlink from '../board/CardHyperlink'

// ── Log line renderer with card-hyperlink parsing (§59) ───────────────────────

// Matches [card:Card Name] or [[Card Name]]
const CARD_TOKEN = /\[card:([^\]]+)\]|\[\[([^\]]+)\]\]/g

function LogLine({ html, undone }: { html: string; undone?: boolean }) {
  // If no card tokens, fall back to dangerouslySetInnerHTML (supports bold etc.)
  if (!CARD_TOKEN.test(html)) {
    CARD_TOKEN.lastIndex = 0
    return (
      <span
        style={{
          color: undone ? 'var(--muted)' : 'var(--paper-dim)',
          textDecoration: undone ? 'line-through' : 'none',
          opacity: undone ? 0.55 : 1,
        }}
        dangerouslySetInnerHTML={{ __html: undone ? html + ' <em>(undone)</em>' : html }}
      />
    )
  }

  // Parse into text + card segments
  CARD_TOKEN.lastIndex = 0
  const parts: Array<{ type: 'text'; value: string } | { type: 'card'; name: string }> = []
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = CARD_TOKEN.exec(html)) !== null) {
    if (m.index > lastIdx) parts.push({ type: 'text', value: html.slice(lastIdx, m.index) })
    const name = m[1] ?? m[2] ?? ''
    parts.push({ type: 'card', name })
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < html.length) parts.push({ type: 'text', value: html.slice(lastIdx) })

  return (
    <span
      style={{
        color: undone ? 'var(--muted)' : 'var(--paper-dim)',
        textDecoration: undone ? 'line-through' : 'none',
        opacity: undone ? 0.55 : 1,
      }}
    >
      {parts.map((p, i) =>
        p.type === 'card'
          ? <CardHyperlink key={i} name={p.name} />
          : <Fragment key={i}>{p.value}</Fragment>
      )}
      {undone && <em> (undone)</em>}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActionLog() {
  const logOpen    = useGameStore((s) => s.ui.logOpen)
  const logEntries = useGameStore((s) => s.logEntries)
  const setUI      = useGameStore((s) => s.setUI)
  const topRef     = useRef<HTMLDivElement>(null)

  // Auto-scroll to top on new entry (most recent = top)
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logEntries.length])

  if (!logOpen) return null

  const reversed = [...logEntries].reverse()

  return (
    <FloatingPanel
      title="Action Log"
      defaultPos={{ x: window.innerWidth - 360, y: 60 }}
      defaultOpen={true}
      onClose={() => setUI({ logOpen: false })}
      width={340}
      zIndex={100}
    >
      <div
        style={{
          maxHeight: 340,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* sentinel for auto-scroll */}
        <div ref={topRef} />

        {reversed.length === 0 && (
          <p style={{ color: 'var(--faint)', fontSize: 'var(--fs-200)', textAlign: 'center', padding: '16px 0' }}>
            No actions yet.
          </p>
        )}

        {reversed.map((entry) => (
          <div
            key={entry.id}
            style={{
              padding: '5px 8px',
              borderRadius: 'var(--r-sm)',
              background: 'rgba(255,255,255,0.03)',
              fontSize: 'var(--fs-200)',
              lineHeight: 1.45,
            }}
          >
            <LogLine html={entry.html} undone={entry.undone} />
            <span
              style={{
                marginLeft: 6,
                fontSize: '0.68rem',
                color: 'var(--faint)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </FloatingPanel>
  )
}

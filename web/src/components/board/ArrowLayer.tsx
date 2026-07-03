/**
 * ArrowLayer — targeting arrows (audit gap #3).
 * Screen-space SVG over the board. Draws an arrow for each ui.arrows entry
 * (card -> card, located via data-instance-id rects so they track pan/zoom),
 * plus a live dashed rubber-band from the targeting source to the cursor.
 * Pointer-events:none so it never blocks board interaction; Escape cancels.
 */
import { useEffect, useReducer, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'

function center(id: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-instance-id="${id}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width) return null
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

export default function ArrowLayer() {
  const arrows = useGameStore((s) => s.ui.arrows)
  const targetingSource = useGameStore((s) => s.ui.targetingSource)
  const cancelTargeting = useGameStore((s) => s.cancelTargeting)
  const attachSource = useGameStore((s) => s.ui.attachSource)
  const cancelAttaching = useGameStore((s) => s.cancelAttaching)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const cursor = useRef({ x: 0, y: 0 })

  const active = arrows.length > 0 || !!targetingSource || !!attachSource

  // Re-measure every frame while arrows/targeting are active (track pan/zoom/moves).
  useEffect(() => {
    if (!active) return
    let raf = 0
    const loop = () => { force(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])

  // Track cursor + Escape-to-cancel while choosing a target / attach host.
  useEffect(() => {
    if (!targetingSource && !attachSource) return
    function onMove(e: PointerEvent) { cursor.current = { x: e.clientX, y: e.clientY } }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { cancelTargeting(); cancelAttaching() } }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('keydown', onKey) }
  }, [targetingSource, attachSource, cancelTargeting, cancelAttaching])

  if (!active) return null

  const lines: { id: string; f: { x: number; y: number }; t: { x: number; y: number } }[] = []
  for (const a of arrows) {
    const f = center(a.from), t = center(a.to)
    if (f && t) lines.push({ id: a.id, f, t })
  }
  let live: { f: { x: number; y: number }; t: { x: number; y: number }; color: string } | null = null
  const liveSource = targetingSource ?? attachSource
  if (liveSource) {
    const f = center(liveSource)
    if (f) live = { f, t: cursor.current, color: targetingSource ? 'var(--accent)' : 'var(--success)' }
  }

  return (
    <svg className="fixed inset-0 z-[58]" style={{ pointerEvents: 'none', width: '100vw', height: '100vh' }}>
      <defs>
        <marker id="arrowhead" markerWidth="11" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L11,4.5 L0,9 Z" fill="var(--brand-bright)" />
        </marker>
        <marker id="arrowhead-live" markerWidth="11" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L11,4.5 L0,9 Z" fill="var(--accent)" />
        </marker>
      </defs>
      {lines.map((l) => (
        <line key={l.id} x1={l.f.x} y1={l.f.y} x2={l.t.x} y2={l.t.y} stroke="var(--brand-bright)" strokeWidth={3} markerEnd="url(#arrowhead)" opacity={0.92} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
      ))}
      {live && <line x1={live.f.x} y1={live.f.y} x2={live.t.x} y2={live.t.y} stroke={live.color} strokeWidth={3} strokeDasharray="7 5" markerEnd="url(#arrowhead-live)" opacity={0.95} />}
    </svg>
  )
}

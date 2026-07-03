/**
 * Board — full-window pan/zoom canvas with seat mats.
 * Pan: middle-mouse drag OR ctrl+drag. Zoom: ctrl+wheel.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import TokenModal from '../modals/TokenModal'
import { useGameEngine } from '../../hooks/useGameEngine'
import { useGameStore } from '../../store/gameStore'
import BoardMat, { SeatRegion } from './BoardMat'

// Virtual board dimensions (matches vanilla table.js)
const BOARD_W = 1600
const BOARD_H = 1180

interface Camera {
  x: number
  y: number
  z: number // zoom scale
}

// ── Seat layout ───────────────────────────────────────────────────────────────

function seatRects(n: number): SeatRegion[] {
  const W = BOARD_W
  const H = BOARD_H
  const PAD = 16

  if (n === 1) {
    return [{ x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2, rot: 0 }]
  }
  if (n === 2) {
    const half = (H - PAD * 3) / 2
    return [
      { x: PAD, y: PAD * 2 + half, w: W - PAD * 2, h: half, rot: 0 },   // seat 0 bottom
      { x: PAD, y: PAD, w: W - PAD * 2, h: half, rot: 180 },              // seat 1 top
    ]
  }
  if (n === 3) {
    const bottomH = (H - PAD * 3) * 0.45
    const topH = H - PAD * 3 - bottomH
    const halfW = (W - PAD * 3) / 2
    return [
      { x: PAD, y: PAD * 2 + topH, w: W - PAD * 2, h: bottomH, rot: 0 },    // seat 0 bottom
      { x: PAD, y: PAD, w: halfW, h: topH, rot: 180 },                         // seat 1 top-left
      { x: PAD * 2 + halfW, y: PAD, w: halfW, h: topH, rot: 180 },             // seat 2 top-right
    ]
  }
  // 4 players
  const halfW = (W - PAD * 3) / 2
  const halfH = (H - PAD * 3) / 2
  return [
    { x: PAD, y: PAD * 2 + halfH, w: halfW, h: halfH, rot: 0 },              // seat 0 bottom-left
    { x: PAD * 2 + halfW, y: PAD * 2 + halfH, w: halfW, h: halfH, rot: 0 },  // seat 1 bottom-right
    { x: PAD, y: PAD, w: halfW, h: halfH, rot: 180 },                          // seat 2 top-left
    { x: PAD * 2 + halfW, y: PAD, w: halfW, h: halfH, rot: 180 },             // seat 3 top-right
  ]
}

// ── Board ─────────────────────────────────────────────────────────────────────

export default function Board() {
  const gameState = useGameStore((s) => s.gameState)
  const mySeat = useGameStore((s) => s.mySeat)
  const openPileMenu = useGameStore((s) => s.openPileMenu)
  const arrows = useGameStore((s) => s.ui.arrows)
  const clearArrows = useGameStore((s) => s.clearArrows)
  const mulliganBottom = useGameStore((s) => s.ui.mulliganBottom)
  const highlightedCardIds = useGameStore((s) => s.ui.highlightedCardIds)
  const setHighlighted = useGameStore((s) => s.setHighlighted)
  const clearHighlighted = useGameStore((s) => s.clearHighlighted)

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 0.72 })
  const [boardMenu, setBoardMenu] = useState<{ x: number; y: number } | null>(null)
  const [showTokens, setShowTokens] = useState(false)
  const [panning, setPanning] = useState(false)
  const [hotkeyHelp, setHotkeyHelp] = useState(false)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const marqueeRef = useRef({ active: false, x0: 0, y0: 0, x1: 0, y1: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ active: boolean; startX: number; startY: number; camX: number; camY: number }>({
    active: false, startX: 0, startY: 0, camX: 0, camY: 0,
  })

  // Center camera on mount / window resize
  const recenter = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    if (!vw || !vh) return
    // Fit the whole board into the viewport so every zone/mat is visible on any screen.
    const PAD = 24
    const fitZ = Math.min((vw - PAD * 2) / BOARD_W, (vh - PAD * 2) / BOARD_H)
    const z = Math.min(2.0, Math.max(0.3, fitZ))
    setCamera({
      z,
      x: (vw - BOARD_W * z) / 2,
      y: (vh - BOARD_H * z) / 2,
    })
  }, [])

  // Re-run once the board viewport actually mounts (gameState arrives async in solo mode).
  const ready = !!gameState
  useEffect(() => {
    if (!ready) return
    recenter()
    const ro = new ResizeObserver(recenter)
    if (viewportRef.current) ro.observe(viewportRef.current)
    return () => ro.disconnect()
  }, [recenter, ready])

  // Keyboard hotkeys (vanilla table.js parity): global D/U/Z/0/?/Esc + per-hovered-card T/F/A/X/I/G/E/H/B/L/P.
  const { dispatch, undo } = useGameEngine()
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const store = useGameStore.getState()
      const seat = store.mySeat
      if (e.key === 'Escape') { store.cancelTargeting(); store.cancelAttaching(); store.clearArrows(); setHotkeyHelp(false); return }
      if (e.key === '?') { e.preventDefault(); setHotkeyHelp((v) => !v); return }
      const k = e.key.toLowerCase()
      // Global (no hovered card needed)
      if (k === 'd') { e.preventDefault(); dispatch({ t: 'draw', seat, count: 1 } as never); return }
      if (k === 'u') { e.preventDefault(); dispatch({ t: 'untap_all', seat } as never); return }
      if (k === 'z') { e.preventDefault(); undo(); return }
      if (k === '0') { e.preventDefault(); recenter(); return }
      // Per-hovered-card
      const id = store.ui.hoveredCardId
      if (!id) return
      const card = store.gameState?.cards?.[id]
      if (!card) return
      const moves: Record<string, string> = { g: 'graveyard', e: 'exile', h: 'hand', b: 'battlefield', l: 'library' }
      if (k === 't') { e.preventDefault(); dispatch({ t: 'card_tap', instanceId: id, tapped: !card.tapped } as never) }
      else if (k === 'f') { e.preventDefault(); dispatch({ t: 'card_flip', instanceId: id, faceDown: !card.faceDown } as never) }
      else if (k === 'a') { e.preventDefault(); dispatch({ t: 'card_transform', instanceId: id } as never) }
      else if (k === 'i') { e.preventDefault(); store.openInspect(id) }
      else if (k === 'x') { e.preventDefault(); const nid = 'tok-' + store.bumpTokenSeq(); dispatch({ t: 'card_clone', fromId: id, instanceId: nid, x: (card.x ?? 50) + 18, y: (card.y ?? 50) + 18 } as never) }
      else if (k === 'p') { e.preventDefault(); if (card.zone === 'hand') dispatch({ t: 'card_move', instanceId: id, toZone: 'battlefield', x: Math.round(90 + Math.random() * 400), y: Math.round(120 + Math.random() * 200) } as never) }
      else if (moves[k]) { e.preventDefault(); dispatch({ t: 'card_move', instanceId: id, toZone: moves[k] } as never) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, undo, recenter])

  // Apply the chosen playmat as the board background.
  const playMat = useGameStore((s) => s.playMat)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    if (!playMat) return // leave the decorative JSX gradient untouched
    if (playMat.type === 'solid') { el.style.background = playMat.value; el.style.backgroundImage = '' }
    else { el.style.backgroundImage = `url("${playMat.value}")`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center' }
  }, [playMat])

  // ── Pointer events for pan ───────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const isMiddle = e.button === 1
    const isCtrlLeft = e.button === 0 && e.ctrlKey
    const onInteractive = !!(e.target as HTMLElement).closest?.('.card-node, [data-zone]')
    if (e.button === 0 && e.shiftKey && !onInteractive) {
      e.preventDefault()
      marqueeRef.current = { active: true, x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY }
      setMarquee({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY })
      viewportRef.current?.setPointerCapture(e.pointerId)
      return
    }
    const isPlainLeftEmpty = e.button === 0 && !e.ctrlKey && !e.shiftKey && !onInteractive
    if (!isMiddle && !isCtrlLeft && !isPlainLeftEmpty) return
    e.preventDefault()
    panRef.current = { active: true, startX: e.clientX, startY: e.clientY, camX: camera.x, camY: camera.y }
    setPanning(true)
    viewportRef.current?.setPointerCapture(e.pointerId)
  }, [camera.x, camera.y])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (marqueeRef.current.active) {
      marqueeRef.current.x1 = e.clientX; marqueeRef.current.y1 = e.clientY
      setMarquee({ x0: marqueeRef.current.x0, y0: marqueeRef.current.y0, x1: e.clientX, y1: e.clientY })
      return
    }
    if (!panRef.current.active) return
    const dx = e.clientX - panRef.current.startX
    const dy = e.clientY - panRef.current.startY
    setCamera((c) => ({ ...c, x: panRef.current.camX + dx, y: panRef.current.camY + dy }))
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (marqueeRef.current.active) {
      marqueeRef.current.active = false
      const { x0, y0, x1, y1 } = marqueeRef.current
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1)
      const ids: string[] = []
      document.querySelectorAll('[data-instance-id]').forEach((el) => {
        if (getComputedStyle(el as HTMLElement).position !== 'absolute') return
        const r = el.getBoundingClientRect()
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2
        if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) { const id = (el as HTMLElement).dataset.instanceId; if (id) ids.push(id) }
      })
      setHighlighted(ids)
      setMarquee(null)
      try { viewportRef.current?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
      return
    }
    panRef.current.active = false
    setPanning(false)
    viewportRef.current?.releasePointerCapture(e.pointerId)
  }, [setHighlighted])

  // ── Wheel for zoom ───────────────────────────────────────────────────────

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.91
    setCamera((c) => {
      const newZ = Math.min(2.6, Math.max(0.28, c.z * factor))
      // zoom toward cursor
      const vp = viewportRef.current
      if (!vp) return { ...c, z: newZ }
      const rect = vp.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const ratio = newZ / c.z
      return {
        z: newZ,
        x: cx - (cx - c.x) * ratio,
        y: cy - (cy - c.y) * ratio,
      }
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    const el = viewportRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel, ready])

  // ── Double-click background → recenter ───────────────────────────────────

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const el = e.target as HTMLElement
    if (!el.closest('.card-node, [data-zone], button, select, input, textarea')) {
      recenter()
    }
  }, [recenter])

  // ── Right-click background ────────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const onInteractive = !!(e.target as HTMLElement).closest?.('.card-node, [data-zone]')
    if (onInteractive) return
    e.preventDefault()
    void openPileMenu
    setBoardMenu({ x: e.clientX, y: e.clientY })
  }, [openPileMenu])

  if (!gameState) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--navy)',
        }}
      >
        <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
          Waiting for game state…
        </p>
      </div>
    )
  }

  const seats = Array.from({ length: gameState.seats }, (_, i) => i)
  const regions = seatRects(gameState.seats)
  // Seat the local player at the bottom (rect[0], upright); opponents rotate around — matches vanilla regionOf().
  const seatOrder = [mySeat, ...seats.filter((s) => s !== mySeat)]

  return (
    <>
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        cursor: panning ? 'grabbing' : 'default',
        touchAction: 'none',
        background: 'var(--navy)',
        backgroundImage: [
          'radial-gradient(120% 80% at 50% -10%, rgba(77,163,255,0.10), transparent 55%)',
          'radial-gradient(90% 70% at 12% 8%, rgba(60,120,210,0.08), transparent 50%)',
          'radial-gradient(90% 70% at 90% 100%, rgba(120,110,200,0.07), transparent 55%)',
        ].join(','),
      }}
    >
      {/* Canvas transform layer */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: BOARD_W,
          height: BOARD_H,
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {/* Felt-like board surface */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--r-xl)',
            background: 'rgba(10,19,34,0.82)',
            border: '1px solid rgba(120,170,230,0.08)',
            boxShadow: 'inset 0 0 120px rgba(0,0,0,0.4)',
          }}
        />

        {/* Player mats */}
        {seats.map((seat) => (
          <BoardMat
            key={seat}
            seat={seat}
            region={regions[seatOrder.indexOf(seat)]}
            mySeat={mySeat}
          />
        ))}

        {/* Annotations overlay */}
        {Object.entries(gameState.annotations ?? {}).map(([annId, ann]) => (
          <div
            key={annId}
            className="group"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', left: ann.x, top: ann.y, zIndex: 15,
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 6px', borderRadius: 'var(--r-sm)',
              background: 'rgba(12,20,36,0.92)',
              border: `1px solid ${ann.color ?? 'var(--hairline)'}`,
              color: ann.color ?? 'var(--paper)',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)',
            }}
          >
            {ann.kind === 'counter' ? (
              <>
                <button onClick={() => dispatch({ t: 'annotation_update', id: annId, value: ann.value - 1 } as never)} style={{ cursor: 'pointer' }}>−</button>
                <span className="tabular-nums">{ann.text ? ann.text + ' ' : ''}{ann.value}</span>
                <button onClick={() => dispatch({ t: 'annotation_update', id: annId, value: ann.value + 1 } as never)} style={{ cursor: 'pointer' }}>+</button>
              </>
            ) : (
              <span suppressContentEditableWarning contentEditable onBlur={(e) => { const v = e.currentTarget.textContent || ''; if (v !== (ann.text || '')) dispatch({ t: 'annotation_update', id: annId, text: v } as never) }} style={{ outline: 'none', cursor: 'text', minWidth: 8 }}>{ann.text || ''}</span>
            )}
            <button onClick={() => dispatch({ t: 'annotation_delete', id: annId } as never)} className="opacity-0 group-hover:opacity-100" style={{ color: 'var(--danger)', cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>
    </div>
    {boardMenu && (
      <>
        <div className="fixed inset-0 z-[88]" onClick={() => setBoardMenu(null)} onContextMenu={(e) => { e.preventDefault(); setBoardMenu(null) }} />
        <div className="fixed z-[89] rounded-lg py-1 text-sm" style={{ left: boardMenu.x, top: boardMenu.y, background: 'var(--panel-strong)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-lg)', minWidth: 160, color: 'var(--paper)' }}>
          <button onClick={() => { setShowTokens(true); setBoardMenu(null) }} className="block w-full text-left px-3 py-1.5 hover:opacity-80">Create token…</button>
          <button onClick={() => { const bx = (boardMenu.x - camera.x) / camera.z, by = (boardMenu.y - camera.y) / camera.z; dispatch({ t: 'annotation_create', id: `anno-${Date.now()}-${Math.floor(Math.random() * 1000)}`, kind: 'label', x: bx, y: by, text: 'Note', value: 0 } as never); setBoardMenu(null) }} className="block w-full text-left px-3 py-1.5 hover:opacity-80">Add label</button>
          <button onClick={() => { const bx = (boardMenu.x - camera.x) / camera.z, by = (boardMenu.y - camera.y) / camera.z; dispatch({ t: 'annotation_create', id: `anno-${Date.now()}-${Math.floor(Math.random() * 1000)}`, kind: 'counter', x: bx, y: by, text: '', value: 0 } as never); setBoardMenu(null) }} className="block w-full text-left px-3 py-1.5 hover:opacity-80">Add counter</button>
          <button onClick={() => { recenter(); setBoardMenu(null) }} className="block w-full text-left px-3 py-1.5 hover:opacity-80">Recenter view</button>
          {arrows.length > 0 && <button onClick={() => { clearArrows(); setBoardMenu(null) }} className="block w-full text-left px-3 py-1.5 hover:opacity-80" style={{ color: 'var(--danger)' }}>Clear arrows ({arrows.length})</button>}
        </div>
      </>
    )}
    {marquee && (
      <div className="fixed z-[70] pointer-events-none" style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0), border: '1px solid var(--brand-bright)', background: 'rgba(77,163,255,0.12)', borderRadius: 2 }} />
    )}
    {highlightedCardIds.size > 0 && (
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--panel-strong)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-lg)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--paper)' }}>{highlightedCardIds.size} selected</span>
        <button onClick={() => dispatch({ t: 'card_tap_many', instanceIds: [...highlightedCardIds], tapped: true } as never)} className="px-2 h-7 rounded text-xs font-semibold" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }}>Tap all</button>
        <button onClick={() => dispatch({ t: 'card_tap_many', instanceIds: [...highlightedCardIds], tapped: false } as never)} className="px-2 h-7 rounded text-xs font-semibold" style={{ border: '1px solid var(--hairline)', color: 'var(--paper)' }}>Untap all</button>
        <button onClick={() => clearHighlighted()} className="px-2 h-7 rounded text-xs font-semibold" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>Clear</button>
      </div>
    )}
    {mulliganBottom > 0 && (
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg text-sm font-semibold pointer-events-none" style={{ background: 'var(--accent)', color: '#04101f', boxShadow: 'var(--shadow-lg)' }}>
        London mulligan: click {mulliganBottom} card{mulliganBottom > 1 ? 's' : ''} in hand to put on the bottom
      </div>
    )}
    <div className="fixed bottom-2 left-2 z-[40] text-[10px] px-2 py-1 rounded pointer-events-none" style={{ background: 'rgba(7,13,26,0.6)', color: 'var(--faint)' }}>Hover a card: T tap · F flip · A transform · G/E/H/B move · right-click menu</div>
    {hotkeyHelp && (
      <div onClick={() => setHotkeyHelp(false)} style={{ position: 'fixed', inset: 0, zIndex: 88, display: 'grid', placeItems: 'center', background: 'rgba(4,8,16,0.7)', backdropFilter: 'blur(6px)' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(92vw, 460px)', padding: 20, borderRadius: 'var(--r-lg)', background: 'var(--panel-strong)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-lg)' }}>
          <h3 style={{ fontSize: 'var(--fs-400)', fontWeight: 700, color: 'var(--paper)', marginBottom: 12 }}>Hotkeys</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 16px' }}>
            {([['T', 'Tap / untap'], ['F', 'Flip'], ['A', 'Transform'], ['X', 'Token copy'], ['I', 'Inspect'], ['G', 'To graveyard'], ['E', 'To exile'], ['H', 'To hand'], ['L', 'To library'], ['B', 'To battlefield'], ['P', 'Play (from hand)'], ['D', 'Draw a card'], ['U', 'Untap all'], ['Z', 'Undo'], ['0', 'Recenter'], ['?', 'This help']] as [string, string][]).map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-200)', color: 'var(--muted)' }}>
                <kbd style={{ minWidth: 22, textAlign: 'center', padding: '2px 5px', borderRadius: 'var(--r-xs)', background: 'var(--ink-3)', border: '1px solid var(--hairline)', color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-100)' }}>{key}</kbd>
                {desc}
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: 'var(--fs-100)', color: 'var(--faint)' }}>Card hotkeys act on the card you are hovering. Press Esc to cancel targeting or close menus.</p>
        </div>
      </div>
    )}
    <TokenModal open={showTokens} onClose={() => setShowTokens(false)} seat={mySeat} />
    </>
  )
}

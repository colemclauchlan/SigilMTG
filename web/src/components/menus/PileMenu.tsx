/**
 * PileMenu — right-click context menu for zone piles (library, graveyard, exile, command).
 * Appears at store.ui.pileMenuPos when store.ui.pileMenuZone is set.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import type { GameStoreState } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'
import type { Zone } from '../../types/game'

const MENU_STYLE: React.CSSProperties = {
  background: 'var(--glass-strong)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)',
  boxShadow: 'var(--shadow-lg)',
  minWidth: 210,
  zIndex: 210,
  overflow: 'hidden',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  color: 'var(--paper)',
}

const ITEM_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '6px 12px',
  background: 'transparent',
  border: 'none',
  color: 'var(--paper)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
  justifyContent: 'space-between',
}

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: 'var(--hairline)',
  margin: '3px 0',
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd style={{
      fontSize: 10, padding: '1px 5px', borderRadius: 4,
      background: 'var(--ink-3)', color: 'var(--muted)',
      border: '1px solid var(--hairline)', fontFamily: 'var(--font-body)',
      marginLeft: 'auto', flexShrink: 0,
    }}>
      {children}
    </kbd>
  )
}

interface ItemProps {
  label: string
  hotkey?: string
  onClick?: () => void
  hasSubmenu?: boolean
  dim?: boolean
}

function Item({ label, hotkey, onClick, hasSubmenu, dim }: ItemProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{ ...ITEM_BASE, background: hovered ? 'var(--brand-soft)' : 'transparent', color: dim ? 'var(--muted)' : 'var(--paper)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {hotkey && <Kbd>{hotkey}</Kbd>}
        {hasSubmenu && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
      </span>
    </button>
  )
}

// ── LibraryMenu ───────────────────────────────────────────────────────────────

interface LibraryMenuProps {
  seat: number
  dispatch: (a: Record<string, unknown>) => void
  store: GameStoreState
  close: () => void
}

function LibraryMenu({ seat, dispatch, store, close }: LibraryMenuProps) {
  function act(a: Record<string, unknown>) { dispatch(a); close() }

  function draw(count: number) { act({ t: 'draw', seat, count }) }
  function mill(count: number) { act({ t: 'mill', seat, count }) }
  function promptMillN() {
    const n = parseInt(prompt('Mill how many cards?', '3') ?? '', 10)
    if (!isNaN(n) && n > 0) { dispatch({ t: 'mill', seat, count: n }); close() }
  }
  function scry(n: number) { store.openScry(n, 'scry'); close() }
  function scryN() {
    const n = parseInt(prompt('Scry how many?', '3') ?? '', 10)
    if (!isNaN(n) && n > 0) { store.openScry(n, 'scry'); close() }
  }
  function surveil(n: number) { store.openScry(n, 'surveil'); close() }
  function shuffle() { act({ t: 'library_shuffle', seat }) }
  function viewLibrary() { store.openViewer('library', seat); close() }
  function tutor() { store.openTutor(true); close() }
  function fetchLand() { store.openFetchLand(true); close() }

  return (
    <>
      <Item label="Draw 1" hotkey="D" onClick={() => draw(1)} />
      <Item label="Draw 7" onClick={() => draw(7)} />
      <Item label="Mill 1" onClick={() => mill(1)} />
      <Item label="Mill N…" onClick={promptMillN} />

      <div style={DIVIDER} />

      <Item label="Scry 1" onClick={() => scry(1)} />
      <Item label="Scry N…" onClick={scryN} />
      <Item label="Surveil 1" onClick={() => surveil(1)} />

      <div style={DIVIDER} />

      <Item label="Reveal & Cast" dim hasSubmenu onClick={close} />
      <Item label="Look at Top N…" dim onClick={close} />

      <div style={DIVIDER} />

      <Item label="Tutor…" onClick={tutor} />
      <Item label="Fetch Land…" onClick={fetchLand} />

      <div style={DIVIDER} />

      <Item label="View Library" onClick={viewLibrary} />
      <Item label="Reveal Top" dim onClick={close} />
      <Item label="Play with Top Revealed" dim onClick={close} />

      <div style={DIVIDER} />

      <Item label="Shuffle" onClick={shuffle} />
    </>
  )
}

// ── GraveyardMenu ─────────────────────────────────────────────────────────────

interface GraveyardMenuProps {
  seat: number
  dispatch: (a: Record<string, unknown>) => void
  store: GameStoreState
  close: () => void
}

function GraveyardMenu({ seat, dispatch, store, close }: GraveyardMenuProps) {
  const gameState = store.gameState

  function viewGraveyard() { store.openViewer('graveyard', seat); close() }

  function shuffleIntoLibrary() {
    if (!gameState) return
    const cards = Object.values(gameState.cards).filter(
      (c) => c.zone === 'graveyard' && c.ownerSeat === seat
    )
    for (const c of cards) dispatch({ t: 'card_move', instanceId: c.instanceId, toZone: 'library' })
    dispatch({ t: 'library_shuffle', seat })
    close()
  }

  function exileAll() {
    if (!gameState) return
    const cards = Object.values(gameState.cards).filter(
      (c) => c.zone === 'graveyard' && c.ownerSeat === seat
    )
    for (const c of cards) dispatch({ t: 'card_move', instanceId: c.instanceId, toZone: 'exile' })
    close()
  }

  return (
    <>
      <Item label="View Graveyard" onClick={viewGraveyard} />
      <Item label="Shuffle into library" onClick={shuffleIntoLibrary} />
      <Item label="Exile all" onClick={exileAll} />
    </>
  )
}

// ── ExileMenu ─────────────────────────────────────────────────────────────────

function ExileMenu({ seat, store, close }: { seat: number; store: GameStoreState; close: () => void }) {
  return (
    <Item label="View Exile" onClick={() => { store.openViewer('exile', seat); close() }} />
  )
}

// ── CommandMenu ───────────────────────────────────────────────────────────────

function CommandMenu({ seat, dispatch, store, close }: GraveyardMenuProps) {
  const gameState = store.gameState

  function castCommander() {
    if (!gameState) return
    const cmdr = Object.values(gameState.cards).find(
      (c) => c.isCommander && c.ownerSeat === seat && c.zone === 'command'
    )
    if (cmdr) dispatch({ t: 'card_move', instanceId: cmdr.instanceId, toZone: 'battlefield' })
    close()
  }

  function cmdTax() {
    if (!gameState) return
    const cmdr = Object.values(gameState.cards).find(
      (c) => c.isCommander && c.ownerSeat === seat && c.zone === 'command'
    )
    if (cmdr) dispatch({ t: 'card_counter', instanceId: cmdr.instanceId, kind: 'tax', delta: 2 })
    close()
  }

  function browseCommand() { store.openViewer('command', seat); close() }

  return (
    <>
      <Item label="Cast commander" onClick={castCommander} />
      <Item label="Commander tax +2" onClick={cmdTax} />
      <Item label="Browse Command" onClick={browseCommand} />
    </>
  )
}

// ── Main PileMenu ─────────────────────────────────────────────────────────────

export default function PileMenu() {
  const store = useGameStore()
  const { dispatch } = useGameEngine()

  const zone = store.ui.pileMenuZone as Zone | null
  const pos = store.ui.pileMenuPos
  const seat = store.mySeat

  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!pos) return
    const W = window.innerWidth
    const H = window.innerHeight
    const menuH = 280
    const menuW = 220
    setMenuPos({
      x: pos.x + menuW > W ? pos.x - menuW : pos.x,
      y: pos.y + menuH > H ? Math.max(0, pos.y - menuH) : pos.y,
    })
  }, [pos])

  const close = useCallback(() => { store.closePileMenu() }, [store])

  useEffect(() => {
    if (!zone) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 80)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [zone, close])

  useEffect(() => {
    if (!zone) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [zone, close])

  if (!zone || !pos) return null

  function renderZoneItems() {
    switch (zone) {
      case 'library':
        return <LibraryMenu seat={seat} dispatch={dispatch} store={store} close={close} />
      case 'graveyard':
        return <GraveyardMenu seat={seat} dispatch={dispatch} store={store} close={close} />
      case 'exile':
        return <ExileMenu seat={seat} store={store} close={close} />
      case 'command':
        return <CommandMenu seat={seat} dispatch={dispatch} store={store} close={close} />
      default:
        return <Item label="Browse" onClick={() => { store.openViewer(zone as Zone, seat); close() }} />
    }
  }

  const zoneLabel = zone.charAt(0).toUpperCase() + zone.slice(1)

  return (
    <div ref={menuRef} style={{ position: 'fixed', zIndex: 210, top: 0, left: 0, width: 0, height: 0 }}>
      <AnimatePresence>
        <motion.div
          key="pile-menu"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
          style={{ ...MENU_STYLE, position: 'fixed', top: menuPos.y, left: menuPos.x }}
        >
          <div style={{ padding: '6px 12px 4px', fontSize: 10, color: 'var(--faint)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            {zoneLabel}
          </div>
          <div style={DIVIDER} />
          {renderZoneItems()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

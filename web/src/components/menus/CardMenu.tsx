/**
 * CardMenu — right-click context menu for cards on the battlefield / stack.
 * Appears at store.ui.cardMenuPos; dispatches via useGameEngine().
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Eye, Zap } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

// ── Shared style constants ────────────────────────────────────────────────────

const MENU_STYLE: React.CSSProperties = {
  background: 'var(--glass-strong)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)',
  boxShadow: 'var(--shadow-lg)',
  minWidth: 230,
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

// ── Sub-menu state type ───────────────────────────────────────────────────────

type SubMenu = 'attach' | 'target' | 'combat' | 'moveto' | null

// ── Helper components ─────────────────────────────────────────────────────────

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
  icon?: React.ReactNode
  onClick?: () => void
  hasSubmenu?: boolean
  danger?: boolean
  dim?: boolean
}

function Item({ label, hotkey, icon, onClick, hasSubmenu, danger, dim }: ItemProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{
        ...ITEM_BASE,
        background: hovered ? 'var(--brand-soft)' : 'transparent',
        color: danger ? 'var(--danger)' : dim ? 'var(--muted)' : 'var(--paper)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        {icon && <span style={{ opacity: 0.6, flexShrink: 0 }}>{icon}</span>}
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {hotkey && <Kbd>{hotkey}</Kbd>}
        {hasSubmenu && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
      </span>
    </button>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ padding: '4px 12px 2px', fontSize: 10, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {children}
    </div>
  )
}

// ── SubPanel — floats to the right of a menu item ────────────────────────────

interface SubPanelProps {
  children: React.ReactNode
  anchorRef: React.RefObject<HTMLDivElement | null>
  menuLeft: number
  menuWidth: number
}

function SubPanel({ children, anchorRef, menuLeft, menuWidth }: SubPanelProps) {
  const [top, setTop] = useState(0)

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setTop(rect.top)
    }
  }, [anchorRef])

  const left = menuLeft + menuWidth + 4
  const right = window.innerWidth - left
  const useLeft = right > 180

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.12 }}
      style={{
        ...MENU_STYLE,
        position: 'fixed',
        top,
        left: useLeft ? left : menuLeft - 180,
        minWidth: 180,
      }}
    >
      {children}
    </motion.div>
  )
}

// ── Main CardMenu ─────────────────────────────────────────────────────────────

export default function CardMenu() {
  const store = useGameStore()
  const { dispatch } = useGameEngine()

  const cardId = store.ui.cardMenuCardId
  const pos = store.ui.cardMenuPos
  const gameState = store.gameState

  const menuRef = useRef<HTMLDivElement>(null)
  const attachRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLDivElement>(null)
  const moveRef = useRef<HTMLDivElement>(null)

  const [activeSubmenu, setActiveSubmenu] = useState<SubMenu>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  const card: import("../../types/game").CardInstance | null = cardId ? (gameState?.cards[cardId] ?? null) : null
  const isCommander = card?.isCommander ?? false
  const zone = card?.zone ?? 'battlefield'
  const isTapped = card?.tapped ?? false
  const isPhased = card?.phased ?? false
  const isFaceDown = card?.faceDown ?? false
  const isAttacking = card?.attacking ?? false

  // Compute flipped position to stay on screen
  useEffect(() => {
    if (!pos) return
    const W = window.innerWidth
    const H = window.innerHeight
    const menuW = 240
    const menuH = 380
    setMenuPos({
      x: pos.x + menuW > W ? pos.x - menuW : pos.x,
      y: pos.y + menuH > H ? Math.max(0, pos.y - menuH) : pos.y,
    })
  }, [pos])

  const close = useCallback(() => {
    store.closeCardMenu()
    setActiveSubmenu(null)
  }, [store])

  // Outside-click closes menu
  useEffect(() => {
    if (!cardId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close()
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 80)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
    }
  }, [cardId, close])

  // Keyboard close
  useEffect(() => {
    if (!cardId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [cardId, close])

  if (!cardId || !pos) return null
  const safeId: string = cardId  // narrowed: cardId is non-null past this point

  // ── Action helpers ────────────────────────────────────────────────────────

  function act(action: Record<string, unknown>) { dispatch(action); close() }

  function tapToggle() { act({ t: 'card_tap', instanceId: cardId, tapped: !isTapped }) }
  function flipCard() { act({ t: 'card_flip', instanceId: cardId, faceDown: !isFaceDown }) }
  function transform() { act({ t: 'card_transform', instanceId: cardId }) }
  function phaseToggle() { act({ t: 'card_phase', instanceId: cardId, phased: !isPhased }) }
  function addPlusCounter() { act({ t: 'card_counter', instanceId: cardId, kind: '+1/+1', delta: 1 }) }
  function moveTo(toZone: string, toPos?: string) {
    act({ t: 'card_move', instanceId: cardId, toZone, ...(toPos ? { pos: toPos } : {}) })
  }
  function tokenCopy() {
    const seq = store.bumpTokenSeq()
    act({ t: 'token_create', instanceId: `token-${seq}`, name: card?.name ? `${card.name} Token` : 'Token', ownerSeat: store.mySeat, controllerSeat: store.mySeat, zone: 'battlefield' })
  }
  function highlight() { store.highlightCard(safeId, true); store.pushLogEntry(`Player highlighted <b>${card?.name ?? safeId}</b>`); close() }
  function inspectCard() { store.openInspect(safeId); close() }
  function openCounters() { store.openCountersModal(safeId); close() }
  function openSetPTPlus() { store.openSetPTModal(safeId + ':+x'); close() }
  function openSetPT() { store.openSetPTModal(safeId + ':pt'); close() }
  function openProliferate() { store.openCountersModal('::proliferate'); close() }
  function cmdTax() { act({ t: 'card_counter', instanceId: cardId, kind: 'tax', delta: 2 }) }
  function declareAttacker() { act({ t: 'card_combat', instanceId: cardId, attacking: !isAttacking }) }
  function putOnStack() { moveTo('stack') }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={menuRef} style={{ position: 'fixed', zIndex: 210, top: 0, left: 0, width: 0, height: 0 }}>
      <AnimatePresence>
        <motion.div
          key="card-menu"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
          style={{ ...MENU_STYLE, position: 'fixed', top: menuPos.y, left: menuPos.x }}
        >
          <Item label={isTapped ? 'Untap' : 'Tap'} hotkey="T" onClick={tapToggle} />
          <Item label={isFaceDown ? 'Turn face up' : 'Turn face down'} hotkey="F" onClick={flipCard} />
          <Item label="Transform (double-faced)" hotkey="A" onClick={transform} />
          <Item label={isPhased ? 'Phase in' : 'Phase out'} onClick={phaseToggle} />

          <div style={DIVIDER} />

          <Item label="Add +1/+1 counter" hotkey="+" onClick={addPlusCounter} />
          <Item label="Counters & Labels…" onClick={openCounters} />
          <Item label="Set +X/+X…" onClick={openSetPTPlus} />
          <Item label="Set P/T…" onClick={openSetPT} />
          <Item label="Proliferate" onClick={openProliferate} icon={<Zap size={12} />} />

          <div style={DIVIDER} />

          <Item label="Highlight / Ping" onClick={highlight} icon={<Zap size={12} />} />

          <div style={DIVIDER} />

          {/* Attach submenu */}
          <div
            ref={attachRef}
            onMouseEnter={() => setActiveSubmenu('attach')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <Item label="Attach to" hasSubmenu />
            <AnimatePresence>
              {activeSubmenu === 'attach' && (
                <SubPanel anchorRef={attachRef} menuLeft={menuPos.x} menuWidth={230}>
                  <SectionLabel>Attach to…</SectionLabel>
                  <Item label="Select a card" onClick={() => { store.startAttaching(safeId); close() }} />
                  <Item label="Clear attachment" onClick={() => act({ t: 'card_attach', instanceId: cardId, attachTo: null })} />
                </SubPanel>
              )}
            </AnimatePresence>
          </div>

          {/* Target submenu */}
          <div
            ref={targetRef}
            onMouseEnter={() => setActiveSubmenu('target')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <Item label="Target" hasSubmenu />
            <AnimatePresence>
              {activeSubmenu === 'target' && (
                <SubPanel anchorRef={targetRef} menuLeft={menuPos.x} menuWidth={230}>
                  <SectionLabel>Target</SectionLabel>
                  <Item label="Draw arrow → pick a card" onClick={() => { store.startTargeting(safeId); close() }} />
                </SubPanel>
              )}
            </AnimatePresence>
          </div>

          <div style={DIVIDER} />

          {zone === 'battlefield' && (
            <>
              <Item label={isAttacking ? 'Remove from combat' : 'Declare attacker'} onClick={declareAttacker} />
              <Item label="Put on stack" onClick={putOnStack} />
              <div style={DIVIDER} />
            </>
          )}

          {/* Move To submenu */}
          <div
            ref={moveRef}
            onMouseEnter={() => setActiveSubmenu('moveto')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <Item label="Move to" hasSubmenu />
            <AnimatePresence>
              {activeSubmenu === 'moveto' && (
                <SubPanel anchorRef={moveRef} menuLeft={menuPos.x} menuWidth={230}>
                  <SectionLabel>Move to zone</SectionLabel>
                  <Item label="Hand" hotkey="H" onClick={() => moveTo('hand')} />
                  <Item label="Battlefield" hotkey="B" onClick={() => moveTo('battlefield')} />
                  <Item label="Graveyard" hotkey="G" onClick={() => moveTo('graveyard')} />
                  <Item label="Command zone" hotkey="C" onClick={() => moveTo('command')} />
                  <Item label="Exile" onClick={() => moveTo('exile')} />
                  <Item label="Library (top)" onClick={() => moveTo('library', 'top')} />
                  <Item label="Library (bottom)" onClick={() => moveTo('library', 'bottom')} />
                </SubPanel>
              )}
            </AnimatePresence>
          </div>

          <div style={DIVIDER} />

          <Item label="Create token copy" hotkey="X" onClick={tokenCopy} />
          <Item label="Change print…" onClick={inspectCard} />

          <div style={DIVIDER} />

          <Item label="Inspect card" hotkey="I" icon={<Eye size={12} />} onClick={inspectCard} />

          {isCommander && (
            <>
              <div style={DIVIDER} />
              <Item label="Commander tax +2" onClick={cmdTax} />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

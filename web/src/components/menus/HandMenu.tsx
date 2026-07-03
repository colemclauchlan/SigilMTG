/**
 * HandMenu — smaller right-click context menu for cards in hand.
 * Same styling as CardMenu but a reduced action set.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Eye } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useGameEngine } from '../../hooks/useGameEngine'

const MENU_STYLE: React.CSSProperties = {
  background: 'var(--glass-strong)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)',
  boxShadow: 'var(--shadow-lg)',
  minWidth: 200,
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
  icon?: React.ReactNode
  onClick?: () => void
  hasSubmenu?: boolean
  dim?: boolean
}

function Item({ label, hotkey, icon, onClick, hasSubmenu, dim }: ItemProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{ ...ITEM_BASE, background: hovered ? 'var(--brand-soft)' : 'transparent', color: dim ? 'var(--muted)' : 'var(--paper)' }}
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

interface SubPanelProps {
  children: React.ReactNode
  anchorRef: React.RefObject<HTMLDivElement | null>
  menuLeft: number
  menuWidth: number
}

function SubPanel({ children, anchorRef, menuLeft, menuWidth }: SubPanelProps) {
  const [top, setTop] = useState(0)
  useEffect(() => {
    if (anchorRef.current) setTop(anchorRef.current.getBoundingClientRect().top)
  }, [anchorRef])
  const left = menuLeft + menuWidth + 4
  const useLeft = (window.innerWidth - left) > 180
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.12 }}
      style={{ ...MENU_STYLE, position: 'fixed', top, left: useLeft ? left : menuLeft - 180, minWidth: 180 }}
    >
      {children}
    </motion.div>
  )
}

export default function HandMenu() {
  const store = useGameStore()
  const { dispatch } = useGameEngine()

  const cardId = store.ui.cardMenuCardId
  const pos = store.ui.cardMenuPos
  const gameState = store.gameState

  const menuRef = useRef<HTMLDivElement>(null)
  const moveRef = useRef<HTMLDivElement>(null)
  const [showMove, setShowMove] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  const card: import("../../types/game").CardInstance | null = cardId ? (gameState?.cards[cardId] ?? null) : null
  const zone = card?.zone

  // Only render for hand zone
  useEffect(() => {
    if (!pos) return
    const W = window.innerWidth
    const H = window.innerHeight
    const menuW = 210
    const menuH = 220
    setMenuPos({
      x: pos.x + menuW > W ? pos.x - menuW : pos.x,
      y: pos.y + menuH > H ? Math.max(0, pos.y - menuH) : pos.y,
    })
  }, [pos])

  const close = useCallback(() => { store.closeCardMenu(); setShowMove(false) }, [store])

  useEffect(() => {
    if (!cardId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 80)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [cardId, close])

  useEffect(() => {
    if (!cardId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [cardId, close])

  // HandMenu only shows when zone === 'hand'
  if (!cardId || !pos || zone !== 'hand') return null

  function act(action: Record<string, unknown>) { dispatch(action); close() }
  function moveTo(toZone: string, toPos?: string) {
    act({ t: 'card_move', instanceId: cardId, toZone, ...(toPos ? { pos: toPos } : {}) })
  }
  function playToBattlefield() { moveTo('battlefield') }
  function playFaceDown() { act({ t: 'card_move', instanceId: cardId, toZone: 'battlefield', faceDown: true }) }
  function inspectCard() { store.openInspect(cardId!); close() }

  return (
    <div ref={menuRef} style={{ position: 'fixed', zIndex: 210, top: 0, left: 0, width: 0, height: 0 }}>
      <AnimatePresence>
        <motion.div
          key="hand-menu"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
          style={{ ...MENU_STYLE, position: 'fixed', top: menuPos.y, left: menuPos.x }}
        >
          <Item label="Play (to battlefield)" hotkey="P" onClick={playToBattlefield} />
          <Item label="Play face-down" onClick={playFaceDown} />

          <div style={DIVIDER} />

          <div
            ref={moveRef}
            onMouseEnter={() => setShowMove(true)}
            onMouseLeave={() => setShowMove(false)}
          >
            <Item label="Move to" hasSubmenu />
            <AnimatePresence>
              {showMove && (
                <SubPanel anchorRef={moveRef} menuLeft={menuPos.x} menuWidth={200}>
                  <SectionLabel>Move to zone</SectionLabel>
                  <Item label="Graveyard" onClick={() => moveTo('graveyard')} />
                  <Item label="Exile" onClick={() => moveTo('exile')} />
                  <Item label="Library (top)" onClick={() => moveTo('library', 'top')} />
                  <Item label="Library (bottom)" onClick={() => moveTo('library', 'bottom')} />
                </SubPanel>
              )}
            </AnimatePresence>
          </div>

          <div style={DIVIDER} />

          <Item label="Inspect card" hotkey="I" icon={<Eye size={12} />} onClick={inspectCard} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

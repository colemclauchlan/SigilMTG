// web/src/components/Nav.tsx
// §60 — Redesigned top bar: icon map, hover tooltips, hover colorize.
//        Tools grouped into a "More" popover so the bar never overflows.
// §62 — Terms helper button in top bar.
// §64 — Bug Report + What's New buttons in More popover.

import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, LogOut, LogIn, MoreHorizontal,
  BookMarked, Bug, Sparkles, Image, Dice6, Trophy, Eye, Film,
} from 'lucide-react'
import SigilSeal from './SigilSeal'
import { useAuth } from '../lib/auth'
import TermsPanel from './TermsPanel'
import BugReportModal from './BugReportModal'
import WhatsNewModal from './WhatsNewModal'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

const NAV_LINKS: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/lobby', label: 'Lobby' },
  { to: '/decks', label: 'Decks' },
  { to: '/build', label: 'Build' },
  { to: '/life', label: 'Life' },
  { to: '/ranked', label: 'Ranked' },
  { to: '/watch',  label: 'Watch' },
  { to: '/replays', label: 'Replays' },
  { to: '/play', label: 'Play' },
]

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tip({ label, visible }: { label: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.92 }}
          transition={{ duration: 0.13 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-[200]"
        >
          <span
            className="whitespace-nowrap text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded"
            style={{
              background: 'var(--ink-3)',
              color: 'var(--paper)',
              border: '1px solid var(--hairline)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── IconBtn — top-bar button with hover-colorize + tooltip ────────────────────
interface IconBtnProps {
  tooltip: string
  onClick?: () => void
  active?: boolean
  children: React.ReactNode
}

function IconBtn({ tooltip, onClick, active, children }: IconBtnProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative inline-grid place-items-center w-8 h-8 rounded-md transition-all duration-[220ms]"
      style={{
        background: active ? 'var(--brand-soft)' : hovered ? 'var(--ink-3)' : 'transparent',
        color: active || hovered ? 'var(--brand-bright)' : 'var(--muted)',
      }}
      aria-label={tooltip}
    >
      <Tip label={tooltip} visible={hovered} />
      {children}
    </button>
  )
}

// ── More popover ──────────────────────────────────────────────────────────────
interface MoreItem {
  label: string
  tooltip: string
  icon: React.ReactNode
  onClick: () => void
}

function MorePopover({ items, onClose }: { items: MoreItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.95 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-full right-0 mt-2 z-[150] w-44 rounded-lg overflow-hidden"
      style={{
        background: 'var(--ink)',
        border: '1px solid var(--hairline)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-medium transition-colors duration-150 hover:bg-[var(--ink-2)]"
          style={{ color: 'var(--paper-dim)' }}
        >
          <span style={{ color: 'var(--muted)' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </motion.div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────
export default function Nav() {
  const { user, playerName, isGuest, signOut, enterGuestMode } = useAuth()
  const navigate = useNavigate()

  const [termsOpen,     setTermsOpen]     = useState(false)
  const [bugOpen,       setBugOpen]       = useState(false)
  const [whatsNewOpen,  setWhatsNewOpen]  = useState(false)
  const [moreOpen,      setMoreOpen]      = useState(false)

  const handleAuth = async () => {
    if (user) { await signOut(); navigate('/') }
    else navigate('/profile')
  }

  const moreItems: MoreItem[] = [
    {
      label: 'Terms Helper',
      tooltip: 'MTG keywords & slang',
      icon: <BookMarked size={14} />,
      onClick: () => setTermsOpen(true),
    },
    {
      label: 'What\'s New',
      tooltip: 'Changelog',
      icon: <Sparkles size={14} />,
      onClick: () => setWhatsNewOpen(true),
    },
    {
      label: 'Playmat',
      tooltip: 'Change playmat',
      icon: <Image size={14} />,
      // Playmat picker opens via Tabletop — nav just navigates to play
      onClick: () => navigate('/play'),
    },
    {
      label: 'Dice',
      tooltip: 'Roll dice',
      icon: <Dice6 size={14} />,
      onClick: () => navigate('/play'),
    },
    {
      label: 'Report Bug',
      tooltip: 'Bug report',
      icon: <Bug size={14} />,
      onClick: () => setBugOpen(true),
    },
  ]

  return (
    <>
      <nav
        className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 border-b"
        style={{
          background: 'var(--glass-strong)',
          backdropFilter: 'blur(16px) saturate(1.2)',
          boxShadow: 'var(--shadow-md)',
          borderColor: 'var(--hairline)',
        }}
      >
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 no-underline flex-shrink-0 mr-2" aria-label="Sigil home">
          <motion.div
            whileHover={{ rotate: 72 }}
            transition={{ duration: 0.46, ease: [0.34, 1.4, 0.5, 1] }}
            style={{ filter: 'drop-shadow(0 2px 8px rgba(77,163,255,0.4))' }}
          >
            <SigilSeal size={24} />
          </motion.div>
          <span
            className="font-display font-bold text-lg tracking-widest uppercase select-none"
            style={{
              background: 'linear-gradient(180deg, #eaf4ff, var(--brand-bright) 58%, var(--brand))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Sigil
          </span>
        </NavLink>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-hidden">
          {NAV_LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'relative px-3 py-2 rounded-sm text-xs font-bold tracking-widest uppercase transition-colors duration-[220ms] whitespace-nowrap',
                  isActive
                    ? 'text-[color:var(--brand-bright)]'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--paper)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute bottom-[3px] left-3 right-3 h-[2px] rounded-full"
                      style={{ background: 'var(--brand)' }}
                      transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Quick-access: Terms */}
        <IconBtn tooltip="Keywords & Slang" onClick={() => setTermsOpen(v => !v)} active={termsOpen}>
          <BookMarked size={15} />
        </IconBtn>

        {/* More popover */}
        <div className="relative flex-shrink-0">
          <IconBtn tooltip="More tools" onClick={() => setMoreOpen(v => !v)} active={moreOpen}>
            <MoreHorizontal size={15} />
          </IconBtn>
          <AnimatePresence>
            {moreOpen && (
              <MorePopover items={moreItems} onClose={() => setMoreOpen(false)} />
            )}
          </AnimatePresence>
        </div>

        {/* Auth section */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
          {!user && !isGuest && (
            <button
              onClick={enterGuestMode}
              className="text-xs font-bold tracking-widest uppercase px-3 py-2 rounded-sm transition-colors duration-[220ms]"
              style={{ color: 'var(--muted)' }}
            >
              Guest
            </button>
          )}

          {/* Avatar → profile */}
          <button
            onClick={() => navigate('/profile')}
            title={user ? `${playerName} — view profile` : 'Sign in / Sign up'}
            className="inline-grid place-items-center w-9 h-9 rounded-full transition-all duration-[220ms] relative"
            style={{
              border: '1px solid var(--hairline)',
              background: user ? 'var(--brand-soft)' : 'var(--ink-2)',
              color: user ? 'var(--brand-bright)' : 'var(--paper-dim)',
            }}
          >
            {user ? (
              <span className="text-xs font-display font-bold">
                {(playerName?.[0] ?? '?').toUpperCase()}
              </span>
            ) : isGuest ? (
              <User size={16} />
            ) : (
              <LogIn size={16} />
            )}
          </button>

          {user && (
            <button
              onClick={handleAuth}
              title="Sign out"
              className="inline-grid place-items-center w-8 h-8 rounded-full transition-all duration-[220ms]"
              style={{
                border: '1px solid var(--hairline)',
                background: 'var(--ink-2)',
                color: 'var(--muted)',
              }}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </nav>

      {/* Tool panels (rendered outside nav flow) */}
      <TermsPanel open={termsOpen} onClose={() => setTermsOpen(false)} />
      <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
      <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </>
  )
}

// web/src/components/WhatsNewModal.tsx
// §64 — "What's New" changelog modal. Seed from P0–P6 work.

import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

interface ChangelogEntry {
  version: string
  date: string
  label?: string
  items: { type: 'feat' | 'fix' | 'perf' | 'new'; text: string }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'P6 — 0.6.0',
    date: '2026-06-29',
    label: 'Icons & Polish',
    items: [
      { type: 'new',  text: 'Unified Icon system: lucide-react icon map, hover tooltips, hover colorize on every button.' },
      { type: 'new',  text: '3D dice & coin: animated CSS/framer-motion roll with tumble + settle + fade.' },
      { type: 'new',  text: 'Terms Helper: searchable Keywords + Slang panel in the top bar (80+ entries, category filters).' },
      { type: 'new',  text: 'Playmat picker: 4 Sigil-brand SVG mats (Void, Forge, Grove, Storm) + solid colors + custom URL.' },
      { type: 'new',  text: 'Bug Report modal: title / category / severity / steps — logs & copies to clipboard.' },
      { type: 'new',  text: 'What\'s New modal (you\'re reading it!).' },
      { type: 'feat', text: 'Nav: tools grouped into a "More" popover so the bar never overflows on small screens.' },
      { type: 'feat', text: 'Landing: full marketing sections — virtual tabletop, deck builder, stats, Card Insights.' },
    ],
  },
  {
    version: 'P5 — 0.5.0',
    date: '2026-06-29',
    label: 'Accounts & Multiplayer',
    items: [
      { type: 'new',  text: 'Lobby with live seat cards, bracket display, and invite link.' },
      { type: 'new',  text: 'Player profiles: onboarding wizard, ELO, match history.' },
      { type: 'new',  text: 'Draft-select room: per-seat deck locking before game start.' },
      { type: 'new',  text: 'In-game chat panel with server-authoritative timestamps.' },
      { type: 'new',  text: 'Spectator mode + reconnect banner.' },
      { type: 'new',  text: 'Card hyperlinks in the Action Log — click a card name to open Scryfall.' },
      { type: 'feat', text: 'Voice chat stub (enable with VITE_VOICE_CHAT_ENABLED, requires TURN server).' },
    ],
  },
  {
    version: 'P4 — 0.4.0',
    date: '2026-06-29',
    label: 'Health & Commander Damage',
    items: [
      { type: 'new',  text: 'HealthCluster: health spread-on-hover with Types / skull icons.' },
      { type: 'new',  text: 'TypesModal: Normal / Poison / Commander damage, Lifelink Apply, solo-safe warnings.' },
      { type: 'new',  text: '21-commander-damage death + 10-poison death, DEAD! overlay with dismiss.' },
      { type: 'new',  text: 'Commander damage icons (yellow circles per-opponent).' },
      { type: 'new',  text: 'Reusable +/− Stepper with hover green/red.' },
    ],
  },
  {
    version: 'P3 — 0.3.0',
    date: '2026-06-29',
    label: 'Server Engine',
    items: [
      { type: 'new',  text: 'Colyseus server: authoritative rules engine (13 modules ported from vanilla).' },
      { type: 'new',  text: 'Full turn structure: untap → draw → main → combat → end, auto-discard-to-7.' },
      { type: 'new',  text: 'Stack with LIFO resolve, reorder, remove, priority passing.' },
      { type: 'new',  text: 'Combat: declare attackers/blockers, damage resolution, trample.' },
      { type: 'new',  text: 'SBA enforcement: 0-toughness, lethal damage, 10 poison, commander damage.' },
      { type: 'perf', text: '50/50 engine tests passing, server tsc clean.' },
    ],
  },
  {
    version: 'P2 — 0.2.0',
    date: '2026-06-28',
    label: 'Tabletop UX',
    items: [
      { type: 'new',  text: 'Full React tabletop: pan/zoom board, drag cards, zones per player.' },
      { type: 'new',  text: 'Right-click card menu with shortcut hints.' },
      { type: 'new',  text: 'Create Token popup: Scryfall search → pick art → quantity → spawn.' },
      { type: 'new',  text: 'Action Log / Stack panel, toggleable full-screen.' },
      { type: 'feat', text: 'Marquee multi-select, hotkeys (T=tap, D=draw, G=graveyard…).' },
    ],
  },
  {
    version: 'P1 — 0.1.0',
    date: '2026-06-28',
    label: 'Card Data & Decks',
    items: [
      { type: 'new',  text: 'Scryfall card search, hi-res art, card viewer.' },
      { type: 'new',  text: 'All WotC Commander precons bundled + Bracket ratings.' },
      { type: 'new',  text: 'Deck builder: import, bracket review, Card Insights analytics.' },
      { type: 'new',  text: 'Draft system: bracket-aware pod draft.' },
    ],
  },
  {
    version: 'P0 — 0.0.1',
    date: '2026-06-28',
    label: 'Foundation',
    items: [
      { type: 'new',  text: 'Vite + React + TypeScript + Tailwind scaffold.' },
      { type: 'new',  text: 'Supabase backend: auth, RLS, hidden-info enforced.' },
      { type: 'new',  text: 'Colyseus game-server skeleton with schema.' },
      { type: 'new',  text: 'Initial Nav, Landing, Tabletop, Lobby, Profile, Decks pages.' },
    ],
  },
]

const TYPE_STYLE: Record<string, { label: string; color: string }> = {
  new:  { label: 'NEW',  color: '#4da3ff' },
  feat: { label: 'FEAT', color: '#46b277' },
  fix:  { label: 'FIX',  color: '#d5a23a' },
  perf: { label: 'PERF', color: '#9867c5' },
}

export default function WhatsNewModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[100] mx-auto max-w-lg flex flex-col"
            style={{
              maxHeight: '80dvh',
              background: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: '14px',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--hairline)' }}>
              <Sparkles size={15} style={{ color: 'var(--brand-bright)' }} />
              <span className="font-display font-bold text-sm tracking-widest uppercase" style={{ color: 'var(--brand-bright)' }}>
                What's New in Sigil
              </span>
              <span className="flex-1" />
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--ink-3)]" style={{ color: 'var(--muted)' }}>
                <X size={14} />
              </button>
            </div>

            {/* Changelog */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
              {CHANGELOG.map((entry, i) => (
                <div key={entry.version}>
                  {/* Version header */}
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="font-display font-bold text-sm" style={{ color: 'var(--brand-bright)' }}>
                      {entry.version}
                    </span>
                    {entry.label && (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                        style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                        {entry.label}
                      </span>
                    )}
                    <span className="ml-auto text-[10px]" style={{ color: 'var(--faint)' }}>{entry.date}</span>
                  </div>

                  {/* Items */}
                  <div className="space-y-1.5">
                    {entry.items.map((item, j) => {
                      const ts = TYPE_STYLE[item.type]
                      return (
                        <div key={j} className="flex items-start gap-2.5">
                          <span
                            className="flex-shrink-0 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded mt-[2px]"
                            style={{ background: ts.color + '20', color: ts.color, border: `1px solid ${ts.color}40` }}
                          >
                            {ts.label}
                          </span>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--paper-dim)' }}>{item.text}</p>
                        </div>
                      )
                    })}
                  </div>

                  {i < CHANGELOG.length - 1 && (
                    <hr className="mt-5" style={{ borderColor: 'var(--hairline)' }} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

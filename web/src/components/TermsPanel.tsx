// web/src/components/TermsPanel.tsx
// §62 — Keyword / slang / terms searchable panel for the top-bar helper button.
// Renders as a floating panel (popover). Parent toggles open/closed.

import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { ALL_TERMS, ALL_CATS_BY_SECTION, getCat, type TermSection } from '../data/terms'

interface Props {
  open: boolean
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement>
}

const SECTION_LABELS: Record<TermSection, string> = {
  keyword: 'Keywords',
  slang:   'Slang & Archetypes',
}

export default function TermsPanel({ open, onClose }: Props) {
  const [query,   setQuery]   = useState('')
  const [section, setSection] = useState<TermSection | 'all'>('all')
  const [catFilter, setCatFilter] = useState<string>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
    else { setQuery(''); setCatFilter('all') }
  }, [open])

  // Escape closes the helper (restores native dialog dismiss).
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const activeCats = useMemo(() => {
    if (section === 'all') {
      const all: Record<string, { label: string; color: string }> = {}
      ;(['keyword', 'slang'] as TermSection[]).forEach(s =>
        Object.entries(ALL_CATS_BY_SECTION[s]).forEach(([k, v]) => { all[`${s}:${k}`] = v })
      )
      return all
    }
    const cats = ALL_CATS_BY_SECTION[section]
    return Object.fromEntries(Object.entries(cats).map(([k, v]) => [`${section}:${k}`, v]))
  }, [section])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL_TERMS.filter(t => {
      if (section !== 'all' && t.section !== section) return false
      if (catFilter !== 'all' && `${t.section}:${t.cat}` !== catFilter) return false
      if (!q) return true
      return t.name.toLowerCase().includes(q) ||
             t.desc.toLowerCase().includes(q) ||
             getCat(t.section, t.cat).label.toLowerCase().includes(q)
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [query, section, catFilter])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[58px] right-4 z-[100] flex flex-col"
            style={{
              width: 'min(520px, calc(100vw - 2rem))',
              maxHeight: 'calc(100dvh - 80px)',
              background: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--hairline)' }}>
              <span className="font-display font-bold text-sm tracking-widest uppercase" style={{ color: 'var(--brand-bright)' }}>
                Terms Helper
              </span>
              <div
                className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md"
                style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}
              >
                <Search size={13} style={{ color: 'var(--muted)' }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search keywords, slang…"
                  className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: 'var(--paper)' }}
                />
                {query && (
                  <button onClick={() => setQuery('')} style={{ color: 'var(--muted)' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--ink-3)]"
                style={{ color: 'var(--muted)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Section tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: 'var(--hairline)' }}>
              {(['all', 'keyword', 'slang'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setSection(s); setCatFilter('all') }}
                  className="px-3 py-1 rounded-sm text-[10px] font-bold tracking-widest uppercase transition-colors duration-150"
                  style={{
                    background: section === s ? 'var(--brand-soft)' : 'transparent',
                    color: section === s ? 'var(--brand-bright)' : 'var(--muted)',
                  }}
                >
                  {s === 'all' ? 'All' : SECTION_LABELS[s]}
                </button>
              ))}
              <span className="flex-1" />
              <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b" style={{ borderColor: 'var(--hairline)' }}>
              <button
                onClick={() => setCatFilter('all')}
                className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  background: catFilter === 'all' ? 'var(--ink-3)' : 'transparent',
                  border: '1px solid var(--hairline)',
                  color: catFilter === 'all' ? 'var(--paper)' : 'var(--muted)',
                }}
              >
                All
              </button>
              {Object.entries(activeCats).map(([key, { label, color }]) => (
                <button
                  key={key}
                  onClick={() => setCatFilter(key === catFilter ? 'all' : key)}
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: catFilter === key ? color + '28' : 'transparent',
                    border: `1px solid ${catFilter === key ? color : 'var(--hairline)'}`,
                    color: catFilter === key ? color : 'var(--muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: 'var(--muted)' }}>
                  No terms match "{query}"
                </p>
              ) : filtered.map(t => {
                const cat = getCat(t.section, t.cat)
                return (
                  <div
                    key={`${t.section}:${t.name}`}
                    className="rounded-md px-3 py-2.5"
                    style={{
                      background: 'var(--ink-2)',
                      borderLeft: `3px solid ${cat.color}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-display font-bold" style={{ color: 'var(--paper)' }}>{t.name}</span>
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: cat.color + '22', color: cat.color }}
                      >
                        {cat.label}
                      </span>
                      <span
                        className="ml-auto text-[9px] uppercase tracking-wider"
                        style={{ color: 'var(--faint)' }}
                      >
                        {t.section === 'keyword' ? 'KW' : 'SL'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--paper-dim)' }}>{t.desc}</p>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

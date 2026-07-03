/**
 * Sigil — PreCons browse + import modal
 *
 * A full-screen modal triggered by a "PreCons" button.
 * Shows all seeded Commander precons filterable by set/color/search.
 * One-click import turns a precon into a SavedDeck.
 */

import { useState, useMemo } from 'react'
import { ALL_PRECONS, getAvailableSets, filterPrecons, type PreconDeck } from '../data/precons'
import { importDecklistText } from '../lib/decks'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  userId?: string
  onImported?: (deckId: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR_PIPS: Record<string, string> = {
  W: '#f5e6c8', U: '#4aa3e6', B: '#9b86c4', R: '#e0655c', G: '#46b277',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColorPip({ color }: { color: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold"
      style={{ background: `${COLOR_PIPS[color] ?? '#888'}33`, color: COLOR_PIPS[color] ?? '#888' }}
    >
      {color}
    </span>
  )
}

function PreconCard({
  precon,
  onImport,
  importing,
}: {
  precon: PreconDeck
  onImport: (precon: PreconDeck) => void
  importing: boolean
}) {
  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg transition-all duration-200 cursor-default group"
      style={{
        background: 'var(--ink-2)',
        border: '1px solid var(--hairline)',
      }}
    >
      {/* Art placeholder / commander name */}
      <div
        className="w-full h-20 rounded-md flex items-end p-2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--ink-3), var(--ink-4))' }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `linear-gradient(135deg, ${COLOR_PIPS[precon.colors[0]] ?? 'var(--brand)'} 0%, transparent 60%)`,
          }}
        />
        <div className="relative z-10">
          <div className="text-[10px] font-bold truncate" style={{ color: 'var(--paper)' }}>
            {precon.commanderName}
          </div>
          {precon.theme && (
            <div className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>
              {precon.theme}
            </div>
          )}
        </div>
      </div>

      {/* Name + set */}
      <div>
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--paper)' }}>
          {precon.name}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--faint)' }}>
          {precon.setName} · {precon.year}
        </div>
      </div>

      {/* Color pips */}
      <div className="flex gap-1">
        {precon.colors.map((c) => <ColorPip key={c} color={c} />)}
      </div>

      {/* Import button */}
      <button
        onClick={() => onImport(precon)}
        disabled={importing}
        className="w-full py-1.5 rounded-md text-[11px] font-bold tracking-widest uppercase transition-all"
        style={{
          background: importing ? 'var(--ink-3)' : 'var(--brand)',
          color: importing ? 'var(--muted)' : '#fff',
          cursor: importing ? 'not-allowed' : 'pointer',
        }}
      >
        {importing ? 'Importing…' : 'Import'}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PreCons({ open, onClose, userId, onImported }: Props) {
  const [search, setSearch] = useState('')
  const [selectedSet, setSelectedSet] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [importingId, setImportingId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  const sets = useMemo(() => getAvailableSets(), [])

  const filtered = useMemo(() =>
    filterPrecons({
      set: selectedSet || undefined,
      color: selectedColor || undefined,
      search: search || undefined,
    }),
    [search, selectedSet, selectedColor]
  )

  async function handleImport(precon: PreconDeck) {
    setImportingId(precon.id)
    setImportError(null)
    setImportSuccess(null)
    try {
      const result = await importDecklistText(precon.decklist, {
        name: `${precon.name} [Precon]`,
        userId,
        resolveCards: true,
      })
      if (result.ok) {
        setImportSuccess(`"${precon.name}" imported!`)
        onImported?.(result.deck.id)
        setTimeout(() => setImportSuccess(null), 3000)
      } else {
        setImportError(result.error)
      }
    } catch (e) {
      setImportError((e as Error).message)
    } finally {
      setImportingId(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center"
          style={{ background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ y: -24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.36 }}
            className="relative flex flex-col w-full max-w-4xl max-h-[90dvh] mt-8 rounded-xl overflow-hidden"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--hairline)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-5 py-4 border-b"
              style={{ borderColor: 'var(--hairline)', background: 'var(--glass-strong)', backdropFilter: 'blur(12px)' }}
            >
              <div>
                <div className="font-display font-bold text-lg" style={{ color: 'var(--paper)' }}>
                  Commander Precons
                </div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  {ALL_PRECONS.length} precons seeded · click any to import into your deck manager
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors"
                style={{ color: 'var(--muted)', background: 'var(--ink-3)' }}
              >
                ✕
              </button>
            </div>

            {/* Filters */}
            <div
              className="flex flex-col sm:flex-row gap-2 px-4 py-3 border-b"
              style={{ borderColor: 'var(--hairline)', background: 'var(--ink-2)' }}
            >
              <input
                type="search"
                placeholder="Search by name or commander…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-md text-xs bg-transparent border"
                style={{ borderColor: 'var(--hairline)', color: 'var(--paper)', background: 'var(--ink)' }}
              />

              <select
                value={selectedSet}
                onChange={(e) => setSelectedSet(e.target.value)}
                className="px-3 py-1.5 rounded-md text-xs border"
                style={{ borderColor: 'var(--hairline)', color: 'var(--paper)', background: 'var(--ink)' }}
              >
                <option value="">All sets</option>
                {sets.map((s) => (
                  <option key={s.set} value={s.set}>{s.setName} ({s.year})</option>
                ))}
              </select>

              <div className="flex gap-1 items-center">
                <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Color:</span>
                {['', 'W', 'U', 'B', 'R', 'G'].map((c) => (
                  <button
                    key={c || 'ALL'}
                    onClick={() => setSelectedColor(c)}
                    className="w-6 h-6 rounded-full text-[9px] font-bold border transition-all"
                    style={{
                      background: c
                        ? (selectedColor === c ? COLOR_PIPS[c] : `${COLOR_PIPS[c]}22`)
                        : (selectedColor === '' ? 'var(--brand)' : 'var(--ink-3)'),
                      color: selectedColor === c || (c === '' && selectedColor === '') ? '#fff' : 'var(--muted)',
                      borderColor: c ? COLOR_PIPS[c] : 'var(--hairline)',
                    }}
                  >
                    {c || '✓'}
                  </button>
                ))}
              </div>
            </div>

            {/* Status banners */}
            {importSuccess && (
              <div className="px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(70,178,119,0.2)', color: 'var(--success)' }}>
                ✓ {importSuccess}
              </div>
            )}
            {importError && (
              <div className="px-4 py-2 text-xs" style={{ background: 'rgba(224,101,92,0.2)', color: 'var(--danger)' }}>
                ✕ {importError}
              </div>
            )}

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--muted)' }}>
                  <span className="text-3xl">📦</span>
                  <span className="text-sm">No precons match</span>
                  <span className="text-xs" style={{ color: 'var(--faint)' }}>Try a different filter</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filtered.map((precon) => (
                    <PreconCard
                      key={precon.id}
                      precon={precon}
                      onImport={handleImport}
                      importing={importingId === precon.id}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-2 text-[10px] border-t flex items-center justify-between"
              style={{ borderColor: 'var(--hairline)', color: 'var(--faint)', background: 'var(--ink-2)' }}
            >
              <span>Showing {filtered.length} of {ALL_PRECONS.length} precons</span>
              <span>More precons drop as data is added — see src/data/precons/index.ts</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

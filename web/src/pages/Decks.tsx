/**
 * Sigil — DeckManager page  (/decks)
 *
 * Lists, creates, imports, and manages decks.
 * Signed-in users → Supabase cloud storage.
 * Guests → localStorage.
 *
 * Left panel: deck list + actions
 * Right panel: DeckViewer + DeckReview tabs
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  listDecks,
  loadDeck,
  deleteDeck,
  importDecklistText,
  importDecklistUrl,
  type SavedDeck,
} from '../lib/decks'
import DeckViewer from '../components/DeckViewer'
import DeckReview from '../components/DeckReview'
import PreCons from '../components/PreCons'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

type PanelTab = 'viewer' | 'review'
type ImportMode = 'text' | 'url'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRACKET_COLORS: Record<number, string> = {
  1: '#9b86c4', 2: '#46b277', 3: '#4aa3e6', 4: '#e0a030', 5: '#e0655c',
}

// ── Import dialog ─────────────────────────────────────────────────────────────

function ImportDialog({
  onImport,
  onClose,
}: {
  onImport: (text: string, url: string, mode: ImportMode) => Promise<void>
  onClose: () => void
}) {
  const [mode, setMode] = useState<ImportMode>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handle() {
    if (mode === 'text' && !text.trim()) { setError('Paste a decklist first.'); return }
    if (mode === 'url' && !url.trim()) { setError('Enter a URL first.'); return }
    setBusy(true); setError('')
    try {
      await onImport(text, url, mode)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: -16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: -8, opacity: 0 }}
        className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{ borderColor: 'var(--hairline)', background: 'var(--glass-strong)' }}
        >
          <div className="flex-1 font-display font-bold" style={{ color: 'var(--paper)' }}>
            Import Deck
          </div>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Mode toggle */}
          <div className="flex rounded-md overflow-hidden border" style={{ borderColor: 'var(--hairline)' }}>
            {(['text', 'url'] as ImportMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className="flex-1 py-1.5 text-xs font-bold uppercase tracking-widest transition-all"
                style={{
                  background: mode === m ? 'var(--brand)' : 'var(--ink-2)',
                  color: mode === m ? '#fff' : 'var(--muted)',
                }}
              >
                {m === 'text' ? 'Paste List' : 'URL (Moxfield / Archidekt)'}
              </button>
            ))}
          </div>

          {mode === 'text' ? (
            <textarea
              rows={12}
              placeholder={`// Commander\n1 Sol Ring\n// Mainboard\n4 Lightning Bolt\n\nSupports: "4 Lightning Bolt", "4x Sol Ring (2ED) 265 *F*"\nPaste sections starting with // Commander, // Sideboard`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-xs font-mono resize-y border"
              style={{
                borderColor: 'var(--hairline)',
                background: 'var(--ink)',
                color: 'var(--paper)',
                minHeight: '180px',
              }}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="url"
                placeholder="https://moxfield.com/decks/... or https://archidekt.com/decks/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-xs border"
                style={{ borderColor: 'var(--hairline)', background: 'var(--ink)', color: 'var(--paper)' }}
              />
              <div className="text-[10px]" style={{ color: 'var(--faint)' }}>
                If the URL is blocked by CORS, paste the decklist text instead.
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(224,101,92,0.18)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <button
            onClick={handle}
            disabled={busy}
            className="py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: busy ? 'var(--ink-3)' : 'var(--brand)',
              color: busy ? 'var(--muted)' : '#fff',
            }}
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── DeckList item ─────────────────────────────────────────────────────────────

function DeckListItem({
  deck,
  active,
  onClick,
  onDelete,
}: {
  deck: SavedDeck
  active: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const bracketColor = deck.bracket ? BRACKET_COLORS[deck.bracket] : undefined

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all duration-150 relative"
      style={{
        background: active ? 'var(--brand-soft)' : 'transparent',
        border: `1px solid ${active ? 'var(--brand)' : 'transparent'}`,
      }}
      onClick={onClick}
    >
      {/* Art */}
      {deck.commanderArtUrl ? (
        <img
          src={deck.commanderArtUrl}
          alt={deck.commanderName}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[var(--hairline)]"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-base"
          style={{ background: 'var(--ink-3)' }}
        >
          🃏
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--paper)' }}>
          {deck.name}
        </div>
        {deck.commanderName && (
          <div className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
            {deck.commanderName}
          </div>
        )}
      </div>

      {/* Bracket badge */}
      {bracketColor && (
        <span
          className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `${bracketColor}22`, color: bracketColor, border: `1px solid ${bracketColor}44` }}
        >
          B{deck.bracket}
        </span>
      )}

      {/* Delete */}
      {confirmDel ? (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(224,101,92,0.3)', color: 'var(--danger)' }}
        >
          Confirm
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000) }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-[11px] transition-opacity"
          style={{ color: 'var(--muted)' }}
          title="Delete deck"
        >
          🗑
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DecksPage() {
  const { user } = useAuth()
  const userId = user?.id
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  // pickFor = gameId set when navigated from DraftRoom "Select Deck"
  const pickFor = searchParams.get('pickFor')

  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [activeDeck, setActiveDeck] = useState<SavedDeck | null>(null)
  const [panelTab, setPanelTab] = useState<PanelTab>('viewer')
  const [showImport, setShowImport] = useState(false)
  const [showPrecons, setShowPrecons] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load decks
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const list = await listDecks(userId)
      setDecks(list)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void refresh() }, [refresh])

  // Select deck (load cards)
  async function selectDeck(deck: SavedDeck) {
    if (deck.cards !== undefined) { setActiveDeck(deck); return }
    try {
      const full = await loadDeck(deck.id, userId)
      if (full) setActiveDeck(full)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(deckId: string) {
    try {
      await deleteDeck(deckId, userId)
      if (activeDeck?.id === deckId) setActiveDeck(null)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleImport(text: string, url: string, mode: ImportMode) {
    let result
    if (mode === 'url') {
      result = await importDecklistUrl(url, { userId })
    } else {
      result = await importDecklistText(text, { userId, resolveCards: true })
    }

    if (!result.ok) throw new Error(result.error)

    await refresh()
    setActiveDeck(result.deck)
    setShowImport(false)
  }

  async function handlePreconImported(deckId: string) {
    await refresh()
    const full = await loadDeck(deckId, userId)
    if (full) setActiveDeck(full)
  }

  return (
    <div
      className="flex h-[calc(100dvh-62px)] overflow-hidden"
      style={{ background: 'var(--navy)' }}
    >
      {/* ── Left panel: deck list ── */}
      <div
        className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: 'var(--hairline)', background: 'var(--panel)' }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--hairline)' }}
        >
          <span className="font-display font-bold text-sm" style={{ color: 'var(--paper)' }}>
            My Decks
          </span>
          <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
            {decks.length}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 p-2 border-b" style={{ borderColor: 'var(--hairline)' }}>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest w-full transition-all"
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            <span>+</span> Import Deck
          </button>
          <button
            onClick={() => setShowPrecons(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest w-full transition-all"
            style={{ background: 'var(--ink-3)', color: 'var(--muted)' }}
          >
            <span>📦</span> PreCons
          </button>
          <button
            onClick={() => navigate('/build')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest w-full transition-all"
            style={{ background: 'var(--ink-3)', color: 'var(--muted)' }}
          >
            <span>🛠</span> Build a deck
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex flex-col gap-1 py-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-11 rounded-md animate-pulse"
                  style={{ background: 'var(--ink-2)' }}
                />
              ))}
            </div>
          ) : decks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <span className="text-2xl">🃏</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>No decks yet</span>
              <span className="text-[10px]" style={{ color: 'var(--faint)' }}>
                Import a deck or browse precons
              </span>
            </div>
          ) : (
            decks.map((deck) => (
              <DeckListItem
                key={deck.id}
                deck={deck}
                active={activeDeck?.id === deck.id}
                onClick={() => selectDeck(deck)}
                onDelete={() => handleDelete(deck.id)}
              />
            ))
          )}
        </div>

        {/* Guest notice */}
        {!userId && (
          <div
            className="px-3 py-2 text-[10px] border-t"
            style={{ borderColor: 'var(--hairline)', color: 'var(--faint)' }}
          >
            Guest mode — decks stored locally. Sign in to sync.
          </div>
        )}
      </div>

      {/* ── Right panel: viewer/review ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeDeck ? (
          <>
            {/* Pick-for-game banner: shown when navigated from DraftRoom */}
            {pickFor && (
              <div
                className="flex items-center justify-between px-4 py-2 border-b"
                style={{ borderColor: 'var(--hairline)', background: 'rgba(77,163,255,0.1)' }}
              >
                <span className="text-xs font-semibold" style={{ color: 'var(--brand-bright)' }}>
                  Picking deck for game
                </span>
                <button
                  onClick={() => navigate(`/lobby/${pickFor}?deck=${encodeURIComponent(activeDeck!.name)}`)}
                  className="px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest"
                  style={{ background: 'var(--brand)', color: '#fff' }}
                >
                  Use this deck ✓
                </button>
              </div>
            )}

            {/* Panel tabs */}
            <div
              className="flex border-b"
              style={{ borderColor: 'var(--hairline)', background: 'var(--ink-2)' }}
            >
              {(['viewer', 'review'] as PanelTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setPanelTab(t)}
                  className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all"
                  style={{
                    color: panelTab === t ? 'var(--brand-bright)' : 'var(--muted)',
                    borderColor: panelTab === t ? 'var(--brand)' : 'transparent',
                    background: 'transparent',
                  }}
                >
                  {t === 'viewer' ? 'Deck Viewer' : 'Bracket Review'}
                </button>
              ))}
              <button
                onClick={() => navigate('/build?deck=' + activeDeck!.id)}
                className="ml-auto px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--brand-bright)' }}
              >
                ✎ Edit in Builder
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {panelTab === 'viewer' ? (
                <DeckViewer
                  deck={activeDeck}
                  onClose={() => setActiveDeck(null)}
                />
              ) : (
                <DeckReview deck={activeDeck} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <span className="text-6xl opacity-20">⚔️</span>
            <div className="text-center">
              <div className="font-display font-bold text-lg mb-1" style={{ color: 'var(--muted)' }}>
                Select a deck
              </div>
              <div className="text-sm" style={{ color: 'var(--faint)' }}>
                or import one to get started
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all"
                style={{ background: 'var(--brand)', color: '#fff' }}
              >
                Import Deck
              </button>
              <button
                onClick={() => setShowPrecons(true)}
                className="px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all"
                style={{ background: 'var(--ink-3)', color: 'var(--muted)' }}
              >
                Browse PreCons
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-xs font-semibold z-50"
            style={{ background: 'rgba(224,101,92,0.9)', color: '#fff' }}
            onClick={() => setError(null)}
          >
            {error} (click to dismiss)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      <AnimatePresence>
        {showImport && (
          <ImportDialog
            onImport={handleImport}
            onClose={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>

      <PreCons
        open={showPrecons}
        onClose={() => setShowPrecons(false)}
        userId={userId}
        onImported={handlePreconImported}
      />
    </div>
  )
}

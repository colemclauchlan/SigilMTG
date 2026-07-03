/**
 * Sigil — DeckReview panel
 *
 * Shows the bracket engine output for a loaded deck:
 *   - Bracket (1–5) + U/L sub-rating
 *   - Card-type counts
 *   - Color % breakdown
 *   - Game Changer count / mass-land-denial / extra-turn flags
 *   - Upgrade suggestions (each annotated "raises bracket?")
 */

import { useMemo, useState } from 'react'
import type { SavedDeck } from '../lib/decks'
import { scoreSavedDeck } from '../lib/decks'
import type { BracketResult, UpgradeSuggestion } from '../lib/bracket'

// ── Constants ─────────────────────────────────────────────────────────────────

const BRACKET_LABELS: Record<number, string> = {
  1: 'Exhibition',
  2: 'Core',
  3: 'Upgraded',
  4: 'Optimized',
  5: 'cEDH',
}

const BRACKET_COLORS: Record<number, string> = {
  1: '#9b86c4',
  2: '#46b277',
  3: '#4aa3e6',
  4: '#e0a030',
  5: '#e0655c',
}

const MANA_COLORS: Record<string, string> = {
  W: '#f5e6c8',
  U: '#4aa3e6',
  B: '#9b86c4',
  R: '#e0655c',
  G: '#46b277',
  C: '#c0c0c0',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--hairline)' }}>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
      <span
        className="text-xs font-bold font-mono"
        style={{ color: danger ? 'var(--danger)' : 'var(--paper)' }}
      >
        {value}
      </span>
    </div>
  )
}

function FlagChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{
        background: active ? 'rgba(224,101,92,0.18)' : 'var(--ink-3)',
        color: active ? 'var(--danger)' : 'var(--faint)',
        border: `1px solid ${active ? 'rgba(224,101,92,0.4)' : 'var(--hairline)'}`,
      }}
    >
      {active ? '⚡ ' : ''}{label}
    </span>
  )
}

function SuggestionCard({ s }: { s: UpgradeSuggestion }) {
  return (
    <div
      className="rounded-md p-3 flex flex-col gap-1"
      style={{ background: 'var(--ink-2)', border: '1px solid var(--hairline)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--paper)' }}>{s.name}</span>
        {s.raisesBracket && (
          <span
            className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(224,101,92,0.2)', color: 'var(--danger)' }}
          >
            ↑ Bracket
          </span>
        )}
      </div>
      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{s.reason}</span>
    </div>
  )
}

function ColorBar({ colorPercent }: { colorPercent: Record<string, number> }) {
  const entries = Object.entries(colorPercent).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([col, pct]) => (
        <div key={col} className="flex items-center gap-2">
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
            style={{ background: `${MANA_COLORS[col] ?? 'var(--brand)'}33`, color: MANA_COLORS[col] ?? 'var(--brand)' }}
          >
            {col}
          </span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-3)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: MANA_COLORS[col] ?? 'var(--brand)',
              }}
            />
          </div>
          <span className="text-[10px] font-mono w-8 text-right" style={{ color: 'var(--muted)' }}>
            {pct}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  deck: SavedDeck
  /** Pre-computed result — if omitted, computed from deck.cards */
  result?: BracketResult
}

export default function DeckReview({ deck, result: propResult }: Props) {
  const [tab, setTab] = useState<'overview' | 'types' | 'colors' | 'suggestions'>('overview')

  const result = useMemo<BracketResult | null>(() => {
    if (propResult) return propResult
    if (!deck.cards || deck.cards.length === 0) return null
    return scoreSavedDeck(deck)
  }, [deck, propResult])

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: 'var(--muted)' }}>
        <span className="text-2xl">📋</span>
        <span className="text-sm">Load a deck to see bracket review.</span>
      </div>
    )
  }

  const bracketColor = BRACKET_COLORS[result.bracket] ?? 'var(--brand)'
  const bracketLabel = BRACKET_LABELS[result.bracket] ?? `Bracket ${result.bracket}`

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--panel)', color: 'var(--text)' }}
    >
      {/* Bracket hero */}
      <div
        className="flex flex-col items-center justify-center gap-1 py-6 px-4"
        style={{
          background: `linear-gradient(180deg, ${bracketColor}18 0%, transparent 100%)`,
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        <div
          className="font-display font-bold text-5xl"
          style={{ color: bracketColor, textShadow: `0 0 32px ${bracketColor}66` }}
        >
          B{result.bracket}
          {result.subRating && (
            <span
              className="text-2xl ml-1 align-middle"
              style={{ color: `${bracketColor}bb` }}
            >
              {result.subRating}
            </span>
          )}
        </div>
        <div className="text-sm font-semibold" style={{ color: bracketColor }}>
          {bracketLabel}
        </div>
        <div className="text-[11px] text-center max-w-[260px]" style={{ color: 'var(--muted)' }}>
          {result.bracket === 1 && 'Casual exhibition play — no power cards.'}
          {result.bracket === 2 && 'Precon-power gameplay. No Game Changers.'}
          {result.bracket === 3 && `Upgraded precon. ${result.gameChangerCount}/3 Game Changers.`}
          {result.bracket === 4 && 'High-power, optimized. Unrestricted Game Changers.'}
          {result.bracket === 5 && 'Competitive (cEDH). Combo/tutor-dense.'}
        </div>

        {/* Flags row */}
        <div className="flex flex-wrap gap-1 justify-center mt-2">
          <FlagChip label="Game Changers" active={result.flags.gameChangers} />
          <FlagChip label="Mass Land Denial" active={result.flags.massLandDenial} />
          <FlagChip label="Extra Turns" active={result.flags.extraTurns} />
          <FlagChip label="Infinite Combo" active={result.flags.infiniteCombos} />
          <FlagChip label="Tutor Density" active={result.flags.tutorDensity} />
          <FlagChip label="Fast Mana" active={result.flags.fastMana} />
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--hairline)', background: 'var(--ink-2)' }}
      >
        {(['overview', 'types', 'colors', 'suggestions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2"
            style={{
              color: tab === t ? bracketColor : 'var(--muted)',
              borderColor: tab === t ? bracketColor : 'transparent',
              background: 'transparent',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'overview' && (
          <div className="flex flex-col">
            <StatRow label="Total cards" value={result.totalCards} />
            <StatRow label="Game Changers" value={result.gameChangerCount} danger={result.gameChangerCount > 0} />
            <StatRow label="Mass-land-denial cards" value={result.massLandDenialCount} danger={result.massLandDenialCount > 0} />
            <StatRow label="Extra-turn cards" value={result.extraTurnCount} danger={result.extraTurnCount > 0} />
            <StatRow label="Tutor count" value={result.tutorCount} danger={result.tutorCount >= 4} />
            <StatRow label="Fast-mana count" value={result.fastManaCount} danger={result.fastManaCount >= 3} />
            <StatRow label="Infinite-combo pairs" value={result.infiniteComboCount} danger={result.infiniteComboCount > 0} />

            {/* GC rule reminder */}
            <div
              className="mt-3 p-3 rounded-md text-[11px] leading-relaxed"
              style={{ background: 'var(--ink-2)', color: 'var(--muted)' }}
            >
              <div className="font-bold mb-1" style={{ color: 'var(--paper)' }}>Game Changers rule</div>
              B1–B2: banned · B3: max 3 · B4–B5: unrestricted
            </div>
          </div>
        )}

        {tab === 'types' && (
          <div className="flex flex-col">
            {Object.entries(result.typeCount)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <StatRow key={type} label={type} value={count} />
              ))}
          </div>
        )}

        {tab === 'colors' && (
          <div className="py-2">
            <ColorBar colorPercent={result.colorPercent} />
            {Object.keys(result.colorPercent).length === 0 && (
              <div className="text-xs text-center py-4" style={{ color: 'var(--faint)' }}>
                Color data unavailable — load deck with Scryfall data for color %
              </div>
            )}
          </div>
        )}

        {tab === 'suggestions' && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] mb-1" style={{ color: 'var(--muted)' }}>
              Suggestions for this bracket. Cards marked <span style={{ color: 'var(--danger)' }}>↑ Bracket</span> will raise your bracket if added.
            </div>
            {result.upgradeSuggestions.length === 0 ? (
              <div className="text-xs text-center py-4" style={{ color: 'var(--faint)' }}>
                No suggestions — deck looks well-tuned for B{result.bracket}.
              </div>
            ) : (
              result.upgradeSuggestions.map((s) => (
                <SuggestionCard key={s.name} s={s} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

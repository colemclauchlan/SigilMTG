/**
 * Sigil — Cloud deck save/load layer
 *
 * Signed-in users: Supabase tables saved_decks + deck_cards (per-user RLS).
 * Guest users: localStorage under 'sigil:decks:<id>'.
 *
 * Tables (from backend/supabase/deck_builder.sql):
 *   public.saved_decks  — deck metadata
 *   public.deck_cards   — per-card rows linked to a deck
 */

import { supabase } from './supabase'
import {
  parseDecklistText,
  batchGetCardsByName,
  getCardByName,
  getExactPrint,
  type ResolvedCard,
  type ParsedDeckLine,
} from './scryfall'
import { scoreDeck, type BracketResult, type DeckCard } from './bracket'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeckSection = 'commander' | 'mainboard' | 'sideboard' | 'maybeboard'

export interface DeckCardEntry {
  id?: string
  deckId?: string
  cardName: string
  quantity: number
  section: DeckSection
  scryfallId?: string
  foil: boolean
  setCode?: string
  collectorNumber?: string
  cardSnapshot?: Partial<ResolvedCard>
  notes?: string
  tags?: string[]
}

export interface SavedDeck {
  id: string
  ownerId?: string
  name: string
  format: string
  commanderName?: string
  commanderScryfallId?: string
  commanderArtUrl?: string
  bracket?: number
  powerLevel?: number
  tags: string[]
  notes: string
  isFavorite: boolean
  sourceUrl?: string
  sourceDeckId?: string
  version: number
  createdAt: string
  updatedAt: string
  cards?: DeckCardEntry[]    // populated on full load
  bracketResult?: BracketResult  // computed locally, not persisted
}

export type DeckImportResult =
  | { ok: true; deck: SavedDeck }
  | { ok: false; error: string }

// ── Local storage (guest) ─────────────────────────────────────────────────────

const LS_DECKS_KEY = 'sigil:decks:index'
const LS_DECK_PREFIX = 'sigil:deck:'

function lsGetDeckIndex(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_DECKS_KEY) ?? '[]') } catch { return [] }
}

function lsSetDeckIndex(ids: string[]): void {
  localStorage.setItem(LS_DECKS_KEY, JSON.stringify(ids))
}

function lsGetDeck(id: string): SavedDeck | null {
  try {
    const raw = localStorage.getItem(LS_DECK_PREFIX + id)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function lsSaveDeck(deck: SavedDeck): void {
  localStorage.setItem(LS_DECK_PREFIX + deck.id, JSON.stringify(deck))
  const index = lsGetDeckIndex()
  if (!index.includes(deck.id)) {
    lsSetDeckIndex([...index, deck.id])
  }
}

function lsDeleteDeck(id: string): void {
  localStorage.removeItem(LS_DECK_PREFIX + id)
  lsSetDeckIndex(lsGetDeckIndex().filter((i) => i !== id))
}

function genId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

function rowToDeck(row: Record<string, unknown>): SavedDeck {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string | undefined,
    name: row.name as string,
    format: row.format as string,
    commanderName: row.commander_name as string | undefined,
    commanderScryfallId: row.commander_scryfall_id as string | undefined,
    commanderArtUrl: row.commander_art_url as string | undefined,
    bracket: row.bracket as number | undefined,
    powerLevel: row.power_level as number | undefined,
    tags: (row.tags as string[]) ?? [],
    notes: (row.notes as string) ?? '',
    isFavorite: (row.is_favorite as boolean) ?? false,
    sourceUrl: row.source_url as string | undefined,
    sourceDeckId: row.source_deck_id as string | undefined,
    version: (row.version as number) ?? 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function rowToCard(row: Record<string, unknown>): DeckCardEntry {
  const snap = (row.card_snapshot as Record<string, unknown>) ?? {}
  const print = (snap._sigil as { foil?: boolean; setCode?: string; collectorNumber?: string } | undefined) ?? {}
  const cleanSnap: Record<string, unknown> = { ...snap }
  delete cleanSnap._sigil
  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    cardName: row.card_name as string,
    quantity: (row.quantity as number) ?? 1,
    section: row.section as DeckSection,
    scryfallId: (row.scryfall_id as string | undefined) ?? (cleanSnap.id as string | undefined),
    foil: !!print.foil,
    setCode: print.setCode,
    collectorNumber: print.collectorNumber,
    cardSnapshot: cleanSnap as Partial<ResolvedCard>,
    notes: (row.notes as string) ?? '',
    tags: (row.tags as string[]) ?? [],
  }
}

// -- Entry merge / dedupe helpers ----------------------------------------------

/**
 * Merge duplicate (cardName, section) entries, summing quantity. Keeps the first
 * entry's print / snapshot / scryfallId / tags / notes. Prevents the
 * unique(deck_id, card_name, section) constraint from rejecting a save (repeated
 * cards, basics on multiple lines, two printings of one card under one schema key).
 */
function mergeCardEntries(cards: DeckCardEntry[]): DeckCardEntry[] {
  const byKey = new Map<string, DeckCardEntry>()
  for (const c of cards) {
    const key = c.section + '::' + c.cardName.toLowerCase().trim()
    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += c.quantity
    } else {
      byKey.set(key, { ...c })
    }
  }
  return [...byKey.values()]
}

/** Stable dedupe by a string key (first occurrence wins). */
function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    const k = key(it)
    if (!seen.has(k)) { seen.add(k); out.push(it) }
  }
  return out
}

// ── Public API ────────────────────────────────────────────────────────────────

/** List all decks for the current user. Guests get localStorage list. */
export async function listDecks(userId?: string): Promise<SavedDeck[]> {
  if (!userId) {
    return lsGetDeckIndex()
      .map((id) => lsGetDeck(id))
      .filter((d): d is SavedDeck => d !== null)
  }
  const { data, error } = await supabase
    .from('saved_decks')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as Record<string, unknown>[]).map(rowToDeck)
}

/** Load a single deck with its cards. */
export async function loadDeck(id: string, userId?: string): Promise<SavedDeck | null> {
  if (!userId) {
    return lsGetDeck(id)
  }
  const { data: deckRow, error: deckErr } = await supabase
    .from('saved_decks')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (deckErr) throw deckErr
  if (!deckRow) return null

  const deck = rowToDeck(deckRow as Record<string, unknown>)

  const { data: cardRows, error: cardErr } = await supabase
    .from('deck_cards')
    .select('*')
    .eq('deck_id', id)
    .order('section')
  if (cardErr) throw cardErr

  deck.cards = (cardRows as Record<string, unknown>[]).map(rowToCard)
  return deck
}

/** Save (create or update) a deck. */
export async function saveDeck(deck: Partial<SavedDeck> & { name: string }, userId?: string): Promise<SavedDeck> {
  const now = new Date().toISOString()

  if (!userId) {
    const existing = deck.id ? lsGetDeck(deck.id) : null
    const saved: SavedDeck = {
      id: deck.id ?? genId(),
      name: deck.name,
      format: deck.format ?? 'commander',
      commanderName: deck.commanderName,
      commanderScryfallId: deck.commanderScryfallId,
      commanderArtUrl: deck.commanderArtUrl,
      bracket: deck.bracket,
      powerLevel: deck.powerLevel,
      tags: deck.tags ?? [],
      notes: deck.notes ?? '',
      isFavorite: deck.isFavorite ?? false,
      sourceUrl: deck.sourceUrl,
      sourceDeckId: deck.sourceDeckId,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      cards: deck.cards,
    }
    lsSaveDeck(saved)
    return saved
  }

  // Keep account decks' version monotonic like the guest path (read-then-increment).
  let nextVersion = 1
  if (deck.id) {
    const { data: vRow } = await supabase
      .from('saved_decks').select('version').eq('id', deck.id).maybeSingle()
    nextVersion = (((vRow as { version?: number } | null)?.version) ?? 0) + 1
  }

  const upsertPayload = {
    ...(deck.id ? { id: deck.id } : {}),
    owner_id: userId,
    name: deck.name,
    format: deck.format ?? 'commander',
    commander_name: deck.commanderName ?? null,
    commander_scryfall_id: deck.commanderScryfallId ?? null,
    commander_art_url: deck.commanderArtUrl ?? null,
    bracket: deck.bracket ?? null,
    power_level: deck.powerLevel ?? null,
    tags: deck.tags ?? [],
    notes: deck.notes ?? '',
    is_favorite: deck.isFavorite ?? false,
    source_url: deck.sourceUrl ?? null,
    source_deck_id: deck.sourceDeckId ?? null,
    version: nextVersion,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('saved_decks')
    .upsert(upsertPayload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return rowToDeck(data as Record<string, unknown>)
}

/** Save card entries for a deck (replaces all existing cards). */
export async function saveDeckCards(
  deckId: string,
  cards: DeckCardEntry[],
  userId?: string,
): Promise<void> {
  // Merge duplicate (name, section) lines so the unique(deck_id, card_name, section)
  // constraint can never reject the batch.
  const merged = mergeCardEntries(cards)

  if (!userId) {
    const deck = lsGetDeck(deckId)
    if (deck) { deck.cards = merged; lsSaveDeck(deck) }
    return
  }

  // FK safety: deck_cards.scryfall_id references card_cache(scryfall_id). Nothing else
  // populates card_cache, so upsert the resolved cards first or the FK insert fails
  // (and a failed insert after the delete below would empty the deck).
  const cacheRows = dedupeBy(
    merged.filter((c) => c.scryfallId),
    (c) => c.scryfallId as string,
  ).map((c) => {
    const snap = (c.cardSnapshot ?? {}) as Partial<ResolvedCard>
    return {
      scryfall_id: c.scryfallId as string,
      name: c.cardName,
      type_line: snap.type_line ?? null,
      oracle_text: snap.oracle_text ?? null,
      cmc: snap.cmc ?? null,
      color_identity: snap.color_identity ?? [],
    }
  })
  if (cacheRows.length > 0) {
    const { error: cacheErr } = await supabase
      .from('card_cache')
      .upsert(cacheRows, { onConflict: 'scryfall_id' })
    if (cacheErr) throw cacheErr
  }

  // Replace the deck's cards. card_cache is populated above (FK holds) and rows are
  // de-duplicated (unique constraint holds), so the realistic insert-failure modes that
  // could empty the deck are removed. A fully atomic replace would need a Postgres RPC.
  const { error: delErr } = await supabase.from('deck_cards').delete().eq('deck_id', deckId)
  if (delErr) throw delErr

  if (merged.length === 0) return

  const rows = merged.map((c) => ({
    deck_id: deckId,
    card_name: c.cardName,
    quantity: c.quantity,
    section: c.section,
    scryfall_id: c.scryfallId ?? null,
    card_snapshot: { ...(c.cardSnapshot ?? {}), _sigil: { foil: c.foil, setCode: c.setCode ?? null, collectorNumber: c.collectorNumber ?? null } },
    tags: c.tags ?? [],
    notes: c.notes ?? '',
  }))

  const { error } = await supabase.from('deck_cards').insert(rows)
  if (error) throw error
}

/** Delete a deck. */
export async function deleteDeck(id: string, userId?: string): Promise<void> {
  if (!userId) { lsDeleteDeck(id); return }
  const { error } = await supabase.from('saved_decks').delete().eq('id', id)
  if (error) throw error
}

// ── Import ────────────────────────────────────────────────────────────────────

/** Import a deck from pasted decklist text. Resolves cards via Scryfall. */
export async function importDecklistText(
  text: string,
  options: {
    name?: string
    userId?: string
    resolveCards?: boolean
    format?: string
  } = {},
): Promise<DeckImportResult> {
  const lines = parseDecklistText(text)
  if (lines.length === 0) return { ok: false, error: 'No card lines found in pasted text.' }

  const cardMap = options.resolveCards !== false
    ? await batchGetCardsByName(lines.map((l) => l.name))
    : new Map<string, ResolvedCard>()

  const commander = lines.find((l) => l.section === 'commander')
  const commanderCard = commander ? cardMap.get(commander.name.toLowerCase()) : undefined

  const deckName =
    options.name ??
    (commanderCard?.name ? `${commanderCard.name} Commander` : 'Imported Deck')

  const entries: DeckCardEntry[] = lines.map((l) => {
    const resolved = cardMap.get(l.name.toLowerCase())
    return {
      cardName: resolved?.name ?? l.name,
      quantity: l.quantity,
      section: l.section,
      scryfallId: resolved?.id,
      foil: l.foil,
      setCode: l.setCode,
      collectorNumber: l.collectorNumber,
      cardSnapshot: resolved ? { ...resolved } : undefined,
    }
  })

  // Pin exact printings: when a line specified "(SET) COLLECTOR", resolve THAT printing
  // instead of the default fuzzy-name one so exact-print / foil import is honoured.
  if (options.resolveCards !== false) {
    await Promise.all(
      entries.map(async (e) => {
        if (!e.setCode || !e.collectorNumber) return
        try {
          const exact = await getExactPrint(e.setCode, e.collectorNumber)
          e.scryfallId = exact.id
          e.cardName = exact.name
          e.cardSnapshot = { ...exact }
        } catch { /* keep the fuzzy-name resolution */ }
      }),
    )
  }

  // Compute the bracket up front so the deck-list and viewer badges (which read
  // deck.bracket) are populated instead of dead UI.
  const scored = scoreDeck(
    entries.map((e) => ({
      name: e.cardName,
      type_line: e.cardSnapshot?.type_line,
      oracle_text: e.cardSnapshot?.oracle_text,
      cmc: e.cardSnapshot?.cmc,
      quantity: e.quantity,
    })),
    commanderCard?.color_identity ?? [],
  )

  const deck = await saveDeck(
    {
      name: deckName,
      format: options.format ?? 'commander',
      commanderName: commanderCard?.name ?? commander?.name,
      commanderScryfallId: commanderCard?.id,
      commanderArtUrl: commanderCard?.primaryImage?.art_crop,
      bracket: scored.bracket,
      cards: entries,
    },
    options.userId,
  )

  if (options.userId) {
    await saveDeckCards(deck.id, entries, options.userId)
  }

  return { ok: true, deck: { ...deck, cards: entries } }
}

/**
 * Import from a Moxfield or Archidekt URL (best-effort).
 * If the URL is blocked by CORS, returns a descriptive error so the caller
 * can fall back to accepting a pasted decklist.
 */
export async function importDecklistUrl(
  url: string,
  options: { userId?: string } = {},
): Promise<DeckImportResult> {
  try {
    // Moxfield API (public decks)
    const moxMatch = url.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/)
    if (moxMatch) {
      const deckId = moxMatch[1]
      const apiUrl = `https://api2.moxfield.com/v3/decks/all/${deckId}`
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error(`Moxfield API returned ${res.status}`)
      const data = await res.json() as {
        name?: string
        format?: string
        mainboard?: Record<string, { quantity: number; card?: { name?: string } }>
        commanders?: Record<string, { quantity: number; card?: { name?: string } }>
        sideboard?: Record<string, { quantity: number; card?: { name?: string } }>
      }

      const lines: ParsedDeckLine[] = []
      for (const [, entry] of Object.entries(data.commanders ?? {})) {
        const name = entry.card?.name ?? ''
        if (name) lines.push({ quantity: 1, name, section: 'commander', foil: false })
      }
      for (const [, entry] of Object.entries(data.mainboard ?? {})) {
        const name = entry.card?.name ?? ''
        if (name) lines.push({ quantity: entry.quantity, name, section: 'mainboard', foil: false })
      }
      for (const [, entry] of Object.entries(data.sideboard ?? {})) {
        const name = entry.card?.name ?? ''
        if (name) lines.push({ quantity: entry.quantity, name, section: 'sideboard', foil: false })
      }

      const text = lines
        .map((l) => `${l.quantity} ${l.name}`)
        .join('\n')

      return importDecklistText(text, {
        name: data.name ?? 'Moxfield Deck',
        userId: options.userId,
        format: data.format,
      })
    }

    // Archidekt (public decks — use their API)
    const archiMatch = url.match(/archidekt\.com\/decks\/(\d+)/)
    if (archiMatch) {
      const deckId = archiMatch[1]
      const apiUrl = `https://archidekt.com/api/decks/${deckId}/small/`
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error(`Archidekt API returned ${res.status}`)
      const data = await res.json() as {
        name?: string
        cards?: Array<{ card?: { oracleCard?: { name?: string } }; quantity?: number; categories?: string[] }>
      }
      const lines: ParsedDeckLine[] = []
      for (const entry of data.cards ?? []) {
        const name = entry.card?.oracleCard?.name ?? ''
        if (!name) continue
        const cats = entry.categories ?? []
        const section: DeckSection = cats.some((c) =>
          c.toLowerCase().includes('commander'),
        )
          ? 'commander'
          : cats.some((c) => c.toLowerCase().includes('sideboard'))
            ? 'sideboard'
            : 'mainboard'
        lines.push({ quantity: entry.quantity ?? 1, name, section, foil: false })
      }
      return importDecklistText(
        lines.map((l) => `${l.quantity} ${l.name}`).join('\n'),
        { name: data.name ?? 'Archidekt Deck', userId: options.userId },
      )
    }

    return { ok: false, error: 'Unrecognized deck URL. Supported: Moxfield, Archidekt.' }
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? String(err) }
  }
}

// ── Score a saved deck (bracket analysis convenience wrapper) ──────────────────
export function scoreSavedDeck(deck: SavedDeck): BracketResult | null {
  try {
    const deckCards: DeckCard[] = (deck.cards ?? []).map((c) => {
      const snap = c.cardSnapshot as Partial<ResolvedCard> | undefined
      return {
        name: c.cardName,
        type_line: snap?.type_line,
        oracle_text: snap?.oracle_text,
        cmc: snap?.cmc,
        quantity: c.quantity ?? 1,
      }
    })
    // Color identity = union across ALL commander rows (partners/backgrounds);
    // fall back to the union over every card when there is no commander row.
    const commanders = (deck.cards ?? []).filter((c) => c.section === 'commander')
    const sources = commanders.length > 0 ? commanders : (deck.cards ?? [])
    const ci = new Set<string>()
    for (const c of sources) {
      const colors = (c.cardSnapshot as Partial<ResolvedCard> | undefined)?.color_identity ?? []
      for (const col of colors) ci.add(col)
    }
    return scoreDeck(deckCards, [...ci])
  } catch {
    return null
  }
}

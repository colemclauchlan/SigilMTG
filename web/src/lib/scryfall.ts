/**
 * Sigil — Scryfall card-data layer
 *
 * Rate-limit note: Scryfall's API guidelines ask for ≤10 req/s with a
 * descriptive User-Agent. We enforce a 100 ms minimum gap between requests
 * via a serial request queue. In a server context add:
 *   headers: { 'User-Agent': 'Sigil/1.0 (sigil.app; cole@sigil.app)' }
 *
 * Docs: https://scryfall.com/docs/api
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScryfallImageSize =
  | 'small' | 'normal' | 'large' | 'png' | 'art_crop' | 'border_crop'

export interface ScryfallImageUris {
  small?: string
  normal?: string
  large?: string
  png?: string
  art_crop?: string
  border_crop?: string
}

export interface ScryfallCardFace {
  name: string
  mana_cost?: string
  type_line?: string
  oracle_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  image_uris?: ScryfallImageUris
  colors?: string[]
  color_indicator?: string[]
}

export interface ScryfallCard {
  id: string
  oracle_id: string
  name: string
  layout: string
  mana_cost?: string
  cmc: number
  type_line: string
  oracle_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  colors?: string[]
  color_identity: string[]
  legalities: Record<string, string>
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
  prints_search_uri: string
  set: string
  set_name: string
  collector_number: string
  rarity: string
  artist?: string
  foil: boolean
  nonfoil: boolean
  prices: Record<string, string | null>
  purchase_uris?: Record<string, string>
  related_uris?: Record<string, string>
  released_at: string
  lang?: string
  promo?: boolean
  variation?: boolean
  variation_of?: string
}

export interface ScryfallList<T> {
  object: 'list'
  total_cards?: number
  has_more: boolean
  next_page?: string
  data: T[]
}

/** ResolvedCard normalises single-face and DFC cards into one shape. */
export interface ResolvedCard extends ScryfallCard {
  primaryImage: ScryfallImageUris
  backImage?: ScryfallImageUris
  displayName: string
}

export interface ParsedDeckLine {
  quantity: number
  name: string
  section: 'commander' | 'mainboard' | 'sideboard' | 'maybeboard'
  foil: boolean
  setCode?: string
  collectorNumber?: string
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v2'
const LS_PREFIX = `sigil:scryfall:${CACHE_VERSION}:`
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CacheEntry { ts: number; card: ScryfallCard }

const memoryCache = new Map<string, CacheEntry>()

/** Read the in-memory cache, honouring the same TTL as localStorage. */
function memGet(key: string): ScryfallCard | undefined {
  const e = memoryCache.get(key)
  if (!e) return undefined
  if (Date.now() - e.ts > CACHE_TTL_MS) { memoryCache.delete(key); return undefined }
  return e.card
}

/** Write the in-memory cache with a timestamp so the TTL above can apply. */
function memSet(key: string, card: ScryfallCard): void {
  memoryCache.set(key, { ts: Date.now(), card })
}

function lsGet(key: string): ScryfallCard | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      localStorage.removeItem(LS_PREFIX + key)
      return null
    }
    return entry.card
  } catch { return null }
}

function lsSet(key: string, card: ScryfallCard): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ ts: Date.now(), card }))
  } catch {
    // Quota exceeded — evict half the Scryfall entries and retry once
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('sigil:scryfall:')) toRemove.push(k)
    }
    toRemove.slice(0, Math.ceil(toRemove.length / 2)).forEach((k) => localStorage.removeItem(k))
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify({ ts: Date.now(), card })) } catch { /* ignore */ }
  }
}

// ── Request queue (≥100 ms between network calls) ────────────────────────────

let lastRequestTime = 0
const requestQueue: Array<() => void> = []
let draining = false

function scheduleRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      const gap = lastRequestTime + 100 - Date.now()
      if (gap > 0) await sleep(gap)
      lastRequestTime = Date.now()
      try { resolve(await fn()) } catch (e) { reject(e) }
    })
    if (!draining) drainQueue()
  })
}

async function drainQueue() {
  draining = true
  while (requestQueue.length) {
    const task = requestQueue.shift()!
    await task()
  }
  draining = false
}

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

// ── Network ───────────────────────────────────────────────────────────────────

const BASE = 'https://api.scryfall.com'

async function sfFetch<T>(path: string, attempt = 0): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const res = await fetch(url)
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    const ra = Number(res.headers.get('retry-after'))
    const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 250 * Math.pow(2, attempt)
    await sleep(waitMs)
    return sfFetch<T>(path, attempt + 1)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { details?: string }
    throw new Error(`Scryfall ${res.status}: ${err.details ?? res.statusText}`)
  }
  return res.json() as Promise<T>
}

// ── Resolve ───────────────────────────────────────────────────────────────────

export function resolveCard(card: ScryfallCard): ResolvedCard {
  const front = card.card_faces?.[0]
  const back = card.card_faces?.[1]
  return {
    ...card,
    primaryImage: card.image_uris ?? front?.image_uris ?? {},
    backImage: back?.image_uris,
    displayName: card.name,
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Fetch single card by exact/fuzzy name. Memory → localStorage → network. */
export async function getCardByName(name: string): Promise<ResolvedCard> {
  const key = `name:${name.toLowerCase().trim()}`
  const mem = memGet(key)
  if (mem) return resolveCard(mem)
  const ls = lsGet(key)
  if (ls) { memSet(key, ls); return resolveCard(ls) }
  return scheduleRequest(async () => {
    const card = await sfFetch<ScryfallCard>(`/cards/named?fuzzy=${encodeURIComponent(name)}`)
    memSet(key, card); lsSet(key, card)
    memSet(`id:${card.id}`, card); lsSet(`id:${card.id}`, card)
    memSet(`name:${card.name.toLowerCase()}`, card); lsSet(`name:${card.name.toLowerCase()}`, card)
    return resolveCard(card)
  })
}

/** Fetch single card by Scryfall UUID. */
export async function getCardById(id: string): Promise<ResolvedCard> {
  const key = `id:${id}`
  const mem = memGet(key)
  if (mem) return resolveCard(mem)
  const ls = lsGet(key)
  if (ls) { memSet(key, ls); return resolveCard(ls) }
  return scheduleRequest(async () => {
    const card = await sfFetch<ScryfallCard>(`/cards/${id}`)
    memSet(key, card); lsSet(key, card)
    return resolveCard(card)
  })
}

/** Full-text search using Scryfall query syntax. */
export async function searchCards(
  query: string,
  { limit = 20, page = 1, order = 'name' }: { limit?: number; page?: number; order?: string } = {},
): Promise<ResolvedCard[]> {
  const out: ScryfallCard[] = []
  let url: string | undefined =
    `${BASE}/cards/search?q=${encodeURIComponent(query)}&page=${page}&order=${encodeURIComponent(order)}`
  while (url && out.length < limit) {
    const here: string = url
    const list = await scheduleRequest(() => sfFetch<ScryfallList<ScryfallCard>>(here))
    out.push(...list.data)
    url = list.has_more ? list.next_page : undefined
  }
  return out.slice(0, limit).map(resolveCard)
}

/** Name autocomplete (≥2 chars). */
export async function autocompleteCardName(partial: string): Promise<string[]> {
  if (partial.length < 2) return []
  return scheduleRequest(async () => {
    const d = await sfFetch<{ data: string[] }>(`/cards/autocomplete?q=${encodeURIComponent(partial)}`)
    return d.data
  })
}

/**
 * Get image URL at the requested size.
 * Falls back: requested → large → normal → small.
 */
export function getCardImage(
  card: ResolvedCard | ScryfallImageUris,
  size: ScryfallImageSize = 'normal',
  face: 'front' | 'back' = 'front',
): string | undefined {
  const uris: ScryfallImageUris =
    'primaryImage' in card
      ? face === 'back' && card.backImage ? card.backImage : card.primaryImage
      : card
  return uris[size] ?? uris.large ?? uris.normal ?? uris.small
}

/** Fetch all prints of a card (for exact-print picker). */
export async function getAllPrints(card: ResolvedCard): Promise<ResolvedCard[]> {
  const out: ScryfallCard[] = []
  let url: string | undefined = card.prints_search_uri
  while (url) {
    const here: string = url
    const list = await scheduleRequest(() => sfFetch<ScryfallList<ScryfallCard>>(here))
    out.push(...list.data)
    url = list.has_more ? list.next_page : undefined
  }
  return out.map(resolveCard)
}

/** Fetch a specific printing by set + collector number. */
export async function getExactPrint(
  set: string, collectorNumber: string, lang = 'en',
): Promise<ResolvedCard> {
  const key = `print:${set}:${collectorNumber}:${lang}`
  const mem = memGet(key)
  if (mem) return resolveCard(mem)
  const ls = lsGet(key)
  if (ls) { memSet(key, ls); return resolveCard(ls) }
  return scheduleRequest(async () => {
    const card = await sfFetch<ScryfallCard>(`/cards/${set}/${collectorNumber}/${lang}`)
    memSet(key, card); lsSet(key, card)
    return resolveCard(card)
  })
}

/** POST /cards/collection in chunks of <=75 identifiers (exact, case-insensitive). */
async function collectionByName(
  names: string[],
): Promise<{ data: ScryfallCard[]; notFound: string[] }> {
  const data: ScryfallCard[] = []
  const notFound: string[] = []
  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75)
    const res = await scheduleRequest(() =>
      fetch(`${BASE}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map((n) => ({ name: n })) }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Scryfall collection ${r.status}`)
        return r.json() as Promise<ScryfallList<ScryfallCard> & { not_found?: Array<{ name?: string }> }>
      }),
    )
    data.push(...res.data)
    for (const nf of res.not_found ?? []) if (nf.name) notFound.push(nf.name)
  }
  return { data, notFound }
}

/**
 * Batch-resolve card names. Cache-first, then ONE POST /cards/collection per 75
 * uncached names (instead of N serial GETs), with a fuzzy fallback for any name
 * the exact collection lookup misses. Missing names are omitted from the map.
 */
export async function batchGetCardsByName(
  names: string[],
): Promise<Map<string, ResolvedCard>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const result = new Map<string, ResolvedCard>()
  const need: string[] = []
  for (const name of unique) {
    const key = `name:${name.toLowerCase()}`
    const cached = memGet(key) ?? lsGet(key)
    if (cached) {
      memSet(key, cached)
      result.set(name.toLowerCase(), resolveCard(cached))
    } else {
      need.push(name)
    }
  }
  if (need.length > 0) {
    const { data, notFound } = await collectionByName(need)
    // Index returned cards by canonical AND front-face name (accent-insensitive) so we
    // can map each card back to the caller's INPUT name — DFC/split front-face names
    // (e.g. "Brutal Cathar" for "Brutal Cathar // Moonrage Brute") and accented names
    // otherwise key under the canonical name and the caller's lookup misses.
    const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const byName = new Map<string, ScryfallCard>()
    for (const c of data) {
      memSet(`id:${c.id}`, c); lsSet(`id:${c.id}`, c)
      memSet(`name:${c.name.toLowerCase()}`, c); lsSet(`name:${c.name.toLowerCase()}`, c)
      byName.set(c.name.toLowerCase(), c); byName.set(fold(c.name), c)
      const front = c.card_faces?.[0]?.name
      if (front) { byName.set(front.toLowerCase(), c); byName.set(fold(front), c) }
    }
    for (const name of need) {
      const c = byName.get(name.toLowerCase()) ?? byName.get(fold(name))
      if (c) {
        memSet(`name:${name.toLowerCase()}`, c); lsSet(`name:${name.toLowerCase()}`, c)
        result.set(name.toLowerCase(), resolveCard(c))
      }
    }
    // Fuzzy fallback for names exact-collection genuinely didn't find.
    await Promise.all(
      notFound
        .filter((name) => !result.has(name.toLowerCase()))
        .map(async (name) => {
          try { result.set(name.toLowerCase(), await getCardByName(name)) } catch { /* not found */ }
        }),
    )
  }
  return result
}

/**
 * Parse a decklist text into structured lines.
 * Supports: "4 Lightning Bolt", "4x Sol Ring (2ED) 265 *F*", "// Commander" sections.
 */
export function parseDecklistText(raw: string): ParsedDeckLine[] {
  const results: ParsedDeckLine[] = []
  let section: ParsedDeckLine['section'] = 'mainboard'

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    // Section headers — "// Commander" OR a bare "Commander"/"Deck"/"Sideboard"/"Maybeboard".
    const header = line.replace(/^\/\/\s*/, '')
    if (/^commanders?\s*:?\s*$/i.test(header)) { section = 'commander'; continue }
    if (/^(sideboard|side)\s*:?\s*$/i.test(header)) { section = 'sideboard'; continue }
    if (/^(maybeboard|maybe)\s*:?\s*$/i.test(header)) { section = 'maybeboard'; continue }
    if (/^(deck|mainboard|main)\s*:?\s*$/i.test(header)) { section = 'mainboard'; continue }
    if (/^\/\//.test(line)) { section = 'mainboard'; continue }

    // "SB:" sideboard prefix and per-line *CMDR* / *E* markers (Moxfield/MTGO).
    let work = line
    let lineSection: ParsedDeckLine['section'] = section
    const sb = work.match(/^SB:\s*/i)
    if (sb) { lineSection = 'sideboard'; work = work.slice(sb[0].length) }
    const isCmdr = /\*CMDR\*/i.test(work)
    work = work.replace(/\s*\*(CMDR|E)\*/gi, '').trim()

    const m = work.match(
      /^(\d+)[x×]?\s+([^(#*\r\n]+?)(?:\s+\((\w{2,5})\)\s*(\S+))?(\s+\*F\*)?$/i,
    )
    if (m) {
      const quantity = Math.max(1, parseInt(m[1], 10))
      const name = m[2].trim()
      if (name) {
        results.push({
          quantity, name,
          section: isCmdr ? 'commander' : lineSection,
          foil: !!m[5],
          setCode: m[3]?.toLowerCase(),
          collectorNumber: m[4],
        })
      }
    }
  }
  return results
}

/** Clear all Scryfall data from memory + localStorage. */
export function clearScryfallCache(): void {
  memoryCache.clear()
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('sigil:scryfall:')) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}

/**
 * Sigil — shared game types (Phase 2).
 * Mirrors table-core.js CardInstance + GameState shape exactly.
 */

// ── Card ─────────────────────────────────────────────────────────────────────

export interface CardInstance {
  instanceId: string
  cardId: string | null
  name: string
  ownerSeat: number
  controllerSeat: number
  zone: Zone
  pos: number
  x: number | null
  y: number | null
  z: number
  tapped: boolean
  faceDown: boolean
  flipped: number
  phased: boolean
  attacking: boolean
  counters: Record<string, number>
  attachedTo: string | null
  attachOrder: number | null
  isToken: boolean
  isCommander: boolean
  setCode: string | null
  collectorNumber: string | null
  isFoil: boolean
  isEtched: boolean
  revealedTo: number[]
  // client enrichment (Scryfall, not in table-core)
  imageUri?: string
  backImageUri?: string
  typeLine?: string
  oraclePower?: string | null
  oracleToughness?: string | null
  isCreature?: boolean
  cmc?: number
  colors?: string[]
  grantedKeywords?: string[]
}

export type Zone =
  | 'library' | 'hand' | 'battlefield'
  | 'graveyard' | 'exile' | 'command' | 'stack'

export const ZONES: Zone[] = ['library','hand','battlefield','graveyard','exile','command','stack']
export const PILE_ZONES: Zone[] = ['library','hand','graveyard','exile','command','stack']

// ── Player ───────────────────────────────────────────────────────────────────

export interface PlayerState {
  seat: number
  life: number
  counters: Record<string, number>
  cmdDamage: Record<string, number>
  name?: string
  connected?: boolean
  mulliganCount?: number
  hasPlayedCard?: boolean
}

// ── Game state ────────────────────────────────────────────────────────────────

export type GamePhase =
  | 'untap' | 'upkeep' | 'draw'
  | 'main1' | 'combat' | 'main2' | 'end'

export interface GameState {
  seats: number
  activeSeat: number
  turn: number
  phase: GamePhase
  players: PlayerState[]
  cards: Record<string, CardInstance>
  annotations: Record<string, AnnotationState>
}

// ── Annotations ───────────────────────────────────────────────────────────────

export type AnnotationKind = 'counter' | 'label' | 'marker' | 'keyword'

export interface AnnotationState {
  id: string
  kind: AnnotationKind
  x: number
  y: number
  text: string
  value: number
  seat: number | null
  color?: string
  pinnedCardId?: string
}

// ── Card image meta ───────────────────────────────────────────────────────────

export interface CardImageMeta {
  img: string
  back?: string
  name: string
  pt?: [string, string] | null
  isCreature?: boolean
  cmc?: number
  colors?: string[]
  type?: string
  oracle?: string
  keywords?: string[]
  scryfallId?: string
}

// ── Scryfall card ─────────────────────────────────────────────────────────────

export interface ScryfallCard {
  id: string
  name: string
  type_line?: string
  oracle_text?: string
  power?: string | null
  toughness?: string | null
  loyalty?: string | null
  cmc?: number
  colors?: string[]
  keywords?: string[]
  rarity?: string
  set?: string
  collector_number?: string
  image_uris?: {
    small?: string; normal?: string; large?: string; png?: string; art_crop?: string
  }
  card_faces?: Array<{
    name?: string; type_line?: string; oracle_text?: string
    power?: string | null; toughness?: string | null
    image_uris?: { small?: string; normal?: string; large?: string; png?: string }
    colors?: string[]; keywords?: string[]
  }>
  prints_search_uri?: string
  scryfall_uri?: string
  purchase_uris?: { tcgplayer?: string; cardmarket?: string }
}

// ── Log entries ───────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string
  ts: number
  html: string
  undone?: boolean
}

// ── Menu position ─────────────────────────────────────────────────────────────

export interface MenuPosition { x: number; y: number }

/**
 * Sigil — Zustand game + UI state store (Phase 2 expansion).
 * Holds the full local GameState driven by the MTGCore reducer (mock/local).
 * Phase 3 will swap applyAction → server intent dispatch; the shape stays the same.
 */
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type {
  GameState, CardInstance, Zone, AnnotationState, LogEntry, MenuPosition, GamePhase
} from '../types/game'

// ── Re-export legacy types so existing imports don't break ────────────────────
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface GameSnapshot {
  roomId: string
  tick: number
  players: Array<{ seat: number; playerId: string; displayName: string; life: number; connected: boolean }>
  phase: string
  activePlayer: number
}

export interface PendingDeck {
  name: string
  cards: { name: string; qty: number; isCommander?: boolean }[]
}

export interface UIState {
  sidebarOpen: boolean
  logOpen: boolean
  settingsOpen: boolean
  autoMode: boolean
  // Phase 2 additions
  inspectCardId: string | null       // card shown in InspectModal
  viewerZone: Zone | null            // library/graveyard/exile viewer open
  viewerSeat: number
  tutorOpen: boolean
  fetchLandOpen: boolean
  scryOpen: boolean
  scryCount: number
  scryMode: 'scry' | 'surveil'
  mulliganDisabled: boolean          // greyed after first card played
  openingHandOpen: boolean           // opening-hand review modal
  cardMenuCardId: string | null      // right-click menu target
  cardMenuPos: MenuPosition | null
  pileMenuZone: Zone | null
  pileMenuPos: MenuPosition | null
  countersModalCardId: string | null
  setPTModalCardId: string | null
  highlightedCardIds: Set<string>
  dragCardId: string | null
  hoveredCardId: string | null
  dropHighlightZone: Zone | null
  targetingSource: string | null
  attachSource: string | null
  arrows: { id: string; from: string; to: string }[]
  mulliganBottom: number
}

// Image metadata cache (Scryfall enrichment)
export interface CardMeta {
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

export interface GameStoreState {
  // ── Legacy connection fields (Phase 0/3 compat) ──
  connectionStatus: ConnectionStatus
  roomId: string | null
  serverUrl: string
  snapshot: GameSnapshot | null

  /**
   * Online mode intent sender — set by Tabletop when useRoom() connects.
   * useGameEngine reads this to decide online vs solo dispatch.
   * null = solo mode (local MTGCore reducer).
   */
  onlineSendIntent: ((intent: import('../lib/net').Intent) => void) | null

  // ── Phase 2: full local game state ──
  gameState: GameState | null
  mySeat: number
  playStarted: boolean
  pendingDeck: PendingDeck | null
  playMat: { type: string; value: string } | null
  imagesById: Record<string, CardMeta>   // cardId → Scryfall meta
  undoStack: Array<{ t: string; [k: string]: unknown }>
  logEntries: LogEntry[]
  manaPool: Record<string, number>
  tokenSeq: number
  gameSeed: string

  // ── UI ──
  ui: UIState

  // ── Game over (#75) ──
  gameOver: { winnerSeat: number; placements: Array<{ seat: number; userId: string; displayName: string; place: number }> } | null
  setGameOver: (data: { winnerSeat: number; placements: Array<{ seat: number; userId: string; displayName: string; place: number }> } | null) => void

  // ── Actions ──
  setConnectionStatus: (s: ConnectionStatus) => void
  setRoomId: (id: string | null) => void
  setServerUrl: (url: string) => void
  applySnapshot: (snap: GameSnapshot) => void
  /** Register / clear the online intent sender (Tabletop calls this on connect/disconnect). */
  setOnlineSendIntent: (fn: ((intent: import('../lib/net').Intent) => void) | null) => void

  // Game state management
  setGameState: (gs: GameState) => void
  setMySeat: (seat: number) => void
  setPlayStarted: (v: boolean) => void
  setPendingDeck: (d: PendingDeck | null) => void
  setPlayMat: (m: { type: string; value: string } | null) => void
  pushImageMeta: (updates: Record<string, CardMeta>) => void
  pushLogEntry: (html: string) => void
  pushUndoEntry: (action: { t: string; [k: string]: unknown }) => void
  popUndo: () => { t: string; [k: string]: unknown } | undefined
  clearLog: () => void
  setManaPool: (pool: Record<string, number>) => void
  bumpTokenSeq: () => number
  resetGame: () => void

  // UI actions
  setUI: (partial: Partial<UIState>) => void
  toggleAutoMode: () => void
  openInspect: (cardId: string | null) => void
  openViewer: (zone: Zone | null, seat?: number) => void
  openTutor: (open: boolean) => void
  openFetchLand: (open: boolean) => void
  openScry: (count: number, mode: 'scry' | 'surveil') => void
  closeScry: () => void
  openCardMenu: (cardId: string, pos: MenuPosition) => void
  closeCardMenu: () => void
  openPileMenu: (zone: Zone, pos: MenuPosition) => void
  closePileMenu: () => void
  openCountersModal: (cardId: string | null) => void
  openSetPTModal: (cardId: string | null) => void
  highlightCard: (cardId: string, on: boolean) => void
  setHighlighted: (ids: string[]) => void
  clearHighlighted: () => void
  setDragCard: (cardId: string | null) => void
  setHoveredCard: (cardId: string | null) => void
  startTargeting: (cardId: string) => void
  finishTargeting: (targetId: string) => void
  cancelTargeting: () => void
  startAttaching: (cardId: string) => void
  cancelAttaching: () => void
  setMulliganBottom: (n: number) => void
  clearArrows: () => void
  removeArrow: (id: string) => void
  setDropHighlight: (zone: Zone | null) => void
  disableMulligan: () => void

  reset: () => void
}

// ── Initial state ─────────────────────────────────────────────────────────────

const initialUI: UIState = {
  sidebarOpen: false,
  logOpen: false,
  settingsOpen: false,
  autoMode: false,
  inspectCardId: null,
  viewerZone: null,
  viewerSeat: 0,
  tutorOpen: false,
  fetchLandOpen: false,
  scryOpen: false,
  scryCount: 1,
  scryMode: 'scry',
  mulliganDisabled: false,
  openingHandOpen: false,
  cardMenuCardId: null,
  cardMenuPos: null,
  pileMenuZone: null,
  pileMenuPos: null,
  countersModalCardId: null,
  setPTModalCardId: null,
  highlightedCardIds: new Set(),
  dragCardId: null,
  hoveredCardId: null,
  dropHighlightZone: null,
  targetingSource: null,
  attachSource: null,
  arrows: [],
  mulliganBottom: 0,
}

let _logSeq = 0
function makeLogId() { return 'log-' + (++_logSeq) + '-' + Date.now() }

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStoreState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // legacy
      gameOver: null,
      connectionStatus: 'disconnected',
      roomId: null,
      serverUrl: import.meta.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567',
      snapshot: null,
      onlineSendIntent: null,

      // game
      gameState: null,
      mySeat: 0,
      playStarted: false,
      pendingDeck: null,
      playMat: null,
      imagesById: {},
      undoStack: [],
      logEntries: [],
      manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      tokenSeq: 0,
      gameSeed: 'g' + Date.now(),

      ui: initialUI,

      // ── Legacy actions ──
      setConnectionStatus: (s) => set({ connectionStatus: s }, false, 'setConnectionStatus'),
      setRoomId: (id) => set({ roomId: id }, false, 'setRoomId'),
      setServerUrl: (url) => set({ serverUrl: url }, false, 'setServerUrl'),
      applySnapshot: (snap) => set({ snapshot: snap }, false, 'applySnapshot'),
      setOnlineSendIntent: (fn) => set({ onlineSendIntent: fn }, false, 'setOnlineSendIntent'),

      setGameOver: (data) => set({ gameOver: data }, false, 'setGameOver'),

      // ── Game actions ──
      setGameState: (gs) => set({ gameState: gs }, false, 'setGameState'),
      setMySeat: (seat) => set({ mySeat: seat }, false, 'setMySeat'),
      setPlayStarted: (v) => set({ playStarted: v }, false, 'setPlayStarted'),
      setPendingDeck: (d) => set({ pendingDeck: d }, false, 'setPendingDeck'),
      setPlayMat: (m) => set({ playMat: m }, false, 'setPlayMat'),

      pushImageMeta: (updates) =>
        set((s) => ({ imagesById: { ...s.imagesById, ...updates } }), false, 'pushImageMeta'),

      pushLogEntry: (html) =>
        set((s) => ({
          logEntries: [
            ...s.logEntries,
            { id: makeLogId(), ts: Date.now(), html }
          ].slice(-200)   // keep last 200
        }), false, 'pushLogEntry'),

      pushUndoEntry: (action) =>
        set((s) => ({ undoStack: [...s.undoStack, action].slice(-50) }), false, 'pushUndoEntry'),

      popUndo: () => {
        const stack = get().undoStack
        if (!stack.length) return undefined
        const last = stack[stack.length - 1]
        set({ undoStack: stack.slice(0, -1) }, false, 'popUndo')
        return last as { t: string; [k: string]: unknown }
      },

      clearLog: () => set({ logEntries: [] }, false, 'clearLog'),

      setManaPool: (pool) => set({ manaPool: pool }, false, 'setManaPool'),

      bumpTokenSeq: () => {
        const seq = get().tokenSeq + 1
        set({ tokenSeq: seq }, false, 'bumpTokenSeq')
        return seq
      },

      resetGame: () =>
        set({
          gameState: null,
          undoStack: [],
          logEntries: [],
          manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
          tokenSeq: 0,
          gameSeed: 'g' + Date.now(),
          ui: initialUI,
        }, false, 'resetGame'),

      // ── UI actions ──
      setUI: (partial) =>
        set((s) => ({ ui: { ...s.ui, ...partial } }), false, 'setUI'),

      toggleAutoMode: () =>
        set((s) => ({ ui: { ...s.ui, autoMode: !s.ui.autoMode } }), false, 'toggleAutoMode'),

      openInspect: (cardId) =>
        set((s) => ({ ui: { ...s.ui, inspectCardId: cardId } }), false, 'openInspect'),

      openViewer: (zone, seat = 0) =>
        set((s) => ({ ui: { ...s.ui, viewerZone: zone, viewerSeat: seat } }), false, 'openViewer'),

      openTutor: (open) =>
        set((s) => ({ ui: { ...s.ui, tutorOpen: open } }), false, 'openTutor'),

      openFetchLand: (open) =>
        set((s) => ({ ui: { ...s.ui, fetchLandOpen: open } }), false, 'openFetchLand'),

      openScry: (count, mode) =>
        set((s) => ({ ui: { ...s.ui, scryOpen: true, scryCount: count, scryMode: mode } }), false, 'openScry'),

      closeScry: () =>
        set((s) => ({ ui: { ...s.ui, scryOpen: false } }), false, 'closeScry'),

      openCardMenu: (cardId, pos) =>
        set((s) => ({ ui: { ...s.ui, cardMenuCardId: cardId, cardMenuPos: pos, pileMenuZone: null, pileMenuPos: null } }), false, 'openCardMenu'),

      closeCardMenu: () =>
        set((s) => ({ ui: { ...s.ui, cardMenuCardId: null, cardMenuPos: null } }), false, 'closeCardMenu'),

      openPileMenu: (zone, pos) =>
        set((s) => ({ ui: { ...s.ui, pileMenuZone: zone, pileMenuPos: pos, cardMenuCardId: null, cardMenuPos: null } }), false, 'openPileMenu'),

      closePileMenu: () =>
        set((s) => ({ ui: { ...s.ui, pileMenuZone: null, pileMenuPos: null } }), false, 'closePileMenu'),

      openCountersModal: (cardId) =>
        set((s) => ({ ui: { ...s.ui, countersModalCardId: cardId } }), false, 'openCountersModal'),

      openSetPTModal: (cardId) =>
        set((s) => ({ ui: { ...s.ui, setPTModalCardId: cardId } }), false, 'openSetPTModal'),

      highlightCard: (cardId, on) =>
        set((s) => {
          const next = new Set(s.ui.highlightedCardIds)
          on ? next.add(cardId) : next.delete(cardId)
          return { ui: { ...s.ui, highlightedCardIds: next } }
        }, false, 'highlightCard'),
      setHighlighted: (ids) =>
        set((s) => ({ ui: { ...s.ui, highlightedCardIds: new Set(ids) } }), false, 'setHighlighted'),
      clearHighlighted: () =>
        set((s) => ({ ui: { ...s.ui, highlightedCardIds: new Set() } }), false, 'clearHighlighted'),

      setDragCard: (cardId) =>
        set((s) => ({ ui: { ...s.ui, dragCardId: cardId } }), false, 'setDragCard'),
      setHoveredCard: (cardId) =>
        set((s) => ({ ui: { ...s.ui, hoveredCardId: cardId } }), false, 'setHoveredCard'),
      startTargeting: (cardId) =>
        set((s) => ({ ui: { ...s.ui, targetingSource: cardId } }), false, 'startTargeting'),
      finishTargeting: (targetId) =>
        set((s) => {
          const from = s.ui.targetingSource
          if (!from || from === targetId) return { ui: { ...s.ui, targetingSource: null } }
          const id = `${from}->${targetId}-${s.ui.arrows.length}`
          return { ui: { ...s.ui, targetingSource: null, arrows: [...s.ui.arrows.filter((a) => !(a.from === from && a.to === targetId)), { id, from, to: targetId }] } }
        }, false, 'finishTargeting'),
      cancelTargeting: () =>
        set((s) => ({ ui: { ...s.ui, targetingSource: null } }), false, 'cancelTargeting'),
      startAttaching: (cardId) =>
        set((s) => ({ ui: { ...s.ui, attachSource: cardId } }), false, 'startAttaching'),
      cancelAttaching: () =>
        set((s) => ({ ui: { ...s.ui, attachSource: null } }), false, 'cancelAttaching'),
      setMulliganBottom: (n) =>
        set((s) => ({ ui: { ...s.ui, mulliganBottom: Math.max(0, n) } }), false, 'setMulliganBottom'),
      clearArrows: () =>
        set((s) => ({ ui: { ...s.ui, arrows: [], targetingSource: null } }), false, 'clearArrows'),
      removeArrow: (id) =>
        set((s) => ({ ui: { ...s.ui, arrows: s.ui.arrows.filter((a) => a.id !== id) } }), false, 'removeArrow'),

      setDropHighlight: (zone) =>
        set((s) => ({ ui: { ...s.ui, dropHighlightZone: zone } }), false, 'setDropHighlight'),

      disableMulligan: () =>
        set((s) => ({ ui: { ...s.ui, mulliganDisabled: true } }), false, 'disableMulligan'),

      reset: () =>
        set({
          connectionStatus: 'disconnected',
          roomId: null,
          snapshot: null,
          onlineSendIntent: null,
          gameState: null,
          undoStack: [],
          logEntries: [],
          manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
          tokenSeq: 0,
          ui: initialUI,
        }, false, 'reset'),
    })),
    { name: 'SigilGame' },
  ),
)

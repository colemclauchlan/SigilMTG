/**
 * Tabletop — full-window MTG board (Phase 2 + Phase 4 health cluster + Phase 7 server wiring).
 *
 * Routing modes (determined by ?roomId= query param):
 *
 *   Online mode (?roomId=<id>):
 *     - Calls useRoom({ roomId }) to join the Colyseus server room.
 *     - Board state comes from server snapshots (written into Zustand by net.ts).
 *     - Every board action goes through sendIntent() → server → broadcast.
 *     - MockGameLoader is DISABLED (server owns state).
 *     - Shows ReconnectBanner on reconnect, and a connection-status indicator.
 *
 *   Solo mode (no roomId):
 *     - MockGameLoader runs and seeds local Zustand state from MTGCore.init().
 *     - All actions go through the local MTGCore reducer (offline/no-server).
 *     - Unchanged from Phase 2 behavior.
 *
 * useGameEngine() receives sendIntent from useRoom in online mode, undefined in solo.
 * It branches internally — callers (Board, HandZone, menus) are mode-agnostic.
 */
import { useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { useRoom } from '../lib/net'
import PlayEntry from './PlayEntry'

// Board
import MockGameLoader from '../components/board/MockGameLoader'
import Board from '../components/board/Board'
import HandZone from '../components/board/HandZone'

// HUD + panels
import PanelShell from '../components/panels/PanelShell'
import StackPanel from '../components/board/StackPanel'
import ArrowLayer from '../components/board/ArrowLayer'
import CombatPanel from '../components/board/CombatPanel'
import OpeningHandModal from '../components/board/OpeningHandModal'
import SelfLifePanel from '../components/hud/SelfLifePanel'
import HoverPreview from '../components/board/HoverPreview'

// Menus
import CardMenu from '../components/menus/CardMenu'
import HandMenu from '../components/menus/HandMenu'
import PileMenu from '../components/menus/PileMenu'

// Modals
import InspectModal from '../components/modals/InspectModal'
import ZoneViewer from '../components/modals/ZoneViewer'
import TutorModal from '../components/modals/TutorModal'
import FetchLandModal from '../components/modals/FetchLandModal'
import ScryModal from '../components/modals/ScryModal'
import CountersModal from '../components/modals/CountersModal'
import SetPTModal from '../components/modals/SetPTModal'
import ProliferateModal from '../components/modals/ProliferateModal'

// Health cluster (Phase 4)
import HealthCluster from '../components/health/HealthCluster'

// Reconnect banner (Phase 5 §57)
import ReconnectBanner from '../components/lobby/ReconnectBanner'

// ── Inner component: has all hooks (useRoom is only called in online mode) ────

// ── Game over overlay (#75) ─────────────────────────────────────────────────

function GameOverOverlay() {
  const gameOver = useGameStore((s) => s.gameOver)
  const setGameOver = useGameStore((s) => s.setGameOver)
  const navigate = useNavigate()

  if (!gameOver) return null

  const winner = gameOver.placements.find((p) => p.seat === gameOver.winnerSeat)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(4,16,31,0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.7, y: -30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-xl)',
          padding: '40px 52px',
          textAlign: 'center',
          minWidth: 320,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏆</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(1.4rem, 4vw, 2rem)',
            color: 'var(--brand-bright)',
            marginBottom: 4,
          }}
        >
          Game Over!
        </div>
        {winner && (
          <div style={{ color: 'var(--paper)', fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>
            {winner.displayName} wins
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          {gameOver.placements.map((p) => (
            <div key={p.seat} style={{ color: p.place === 1 ? 'var(--brand-bright)' : 'var(--muted)', fontSize: '0.875rem' }}>
              #{p.place} — {p.displayName}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={() => { setGameOver(null); navigate('/lobby') }}
            style={{
              padding: '8px 20px', borderRadius: 'var(--r-md)',
              background: 'var(--brand)', color: '#fff',
              fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
              border: 'none',
            }}
          >
            Back to Lobby
          </button>
          <button
            onClick={() => setGameOver(null)}
            style={{
              padding: '8px 20px', borderRadius: 'var(--r-md)',
              background: 'var(--ink-3)', color: 'var(--muted)',
              fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
              border: '1px solid var(--hairline)',
            }}
          >
            Dismiss
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TabletopOnline({ roomId }: { roomId: string }) {
  const mySeat = useGameStore((s) => s.mySeat)
  const setOnlineSendIntent = useGameStore((s) => s.setOnlineSendIntent)

  // Connect to server — sendIntent wires board actions to the server.
  // justReconnected triggers the ReconnectBanner.
  const { connected, error, justReconnected, sendIntent } = useRoom({
    roomId,
    autoConnect: true,
  })

  // Register sendIntent in the store on connect; clear it on unmount.
  // This lets useGameEngine() in any descendant route actions to the server
  // without prop-drilling sendIntent through every menu/modal component.
  useEffect(() => {
    if (connected) {
      setOnlineSendIntent(sendIntent)
    }
    return () => {
      setOnlineSendIntent(null)
    }
  }, [connected, sendIntent, setOnlineSendIntent])

  // Menu/modal state
  const cardMenuCardId = useGameStore((s) => s.ui.cardMenuCardId)
  const inspectCardId  = useGameStore((s) => s.ui.inspectCardId)
  const viewerZone     = useGameStore((s) => s.ui.viewerZone)
  const tutorOpen      = useGameStore((s) => s.ui.tutorOpen)
  const fetchLandOpen  = useGameStore((s) => s.ui.fetchLandOpen)
  const scryOpen       = useGameStore((s) => s.ui.scryOpen)
  const countersId     = useGameStore((s) => s.ui.countersModalCardId)
  const setPTId        = useGameStore((s) => s.ui.setPTModalCardId)
  const pileMenuZone   = useGameStore((s) => s.ui.pileMenuZone)

  const gameState = useGameStore((s) => s.gameState)
  const menuCard: import("../types/game").CardInstance | null = cardMenuCardId ? (gameState?.cards[cardMenuCardId] ?? null) : null
  const isHandCard = menuCard?.zone === 'hand'

  const proliferateOpen = countersId === '::proliferate'
  const realCountersId  = (countersId && countersId !== '::proliferate') ? countersId : null

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--navy)' }}>
      {/* MockGameLoader is DISABLED — server snapshot drives state */}
      <MockGameLoader disabled />

      {/* Connection status indicator (top-right, online mode only) */}
      <div
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 51,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          borderRadius: 'var(--r-sm)',
          background: 'var(--glass)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--hairline)',
          fontSize: 11,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          color: connected ? 'var(--success)' : (error ? 'var(--danger)' : 'var(--muted)'),
          letterSpacing: '0.04em',
        }}
      >
        {connected ? (
          <><Wifi size={10} strokeWidth={2.5} /> Online</>
        ) : error ? (
          <><WifiOff size={10} strokeWidth={2.5} /> Disconnected</>
        ) : (
          <><Loader2 size={10} strokeWidth={2.5} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</>
        )}
      </div>

      <Board />
      <HandZone seat={mySeat} />
      <PanelShell />
      <StackPanel />
      <ArrowLayer />
      <CombatPanel />
      <OpeningHandModal />
      <SelfLifePanel />
      <HoverPreview />
      <HealthCluster mySeat={mySeat} />

      <Link
        to="/lobby"
        style={{
          position: 'fixed', top: 52, left: 10, zIndex: 51,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 9px', borderRadius: 'var(--r-sm)',
          background: 'var(--glass)', backdropFilter: 'blur(10px)',
          border: '1px solid var(--hairline)', color: 'var(--faint)',
          textDecoration: 'none', fontSize: 11,
          fontFamily: 'var(--font-body)', fontWeight: 600,
          letterSpacing: '0.04em', transition: 'color 150ms, border-color 150ms',
        }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.color = 'var(--paper)'; el.style.borderColor = 'rgba(77,163,255,0.4)' }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.color = 'var(--faint)'; el.style.borderColor = 'var(--hairline)' }}
      >
        <ArrowLeft size={11} strokeWidth={2.5} />
        Lobby
      </Link>

      <AnimatePresence>
        {cardMenuCardId && !isHandCard && <CardMenu key="card-menu" />}
      </AnimatePresence>
      <AnimatePresence>
        {cardMenuCardId && isHandCard && <HandMenu key="hand-menu" />}
      </AnimatePresence>
      <AnimatePresence>
        {pileMenuZone && <PileMenu key="pile-menu" />}
      </AnimatePresence>
      <AnimatePresence>
        {inspectCardId && <InspectModal key="inspect" />}
      </AnimatePresence>
      <AnimatePresence>
        {viewerZone && <ZoneViewer key="zone-viewer" />}
      </AnimatePresence>
      <AnimatePresence>
        {tutorOpen && <TutorModal key="tutor" />}
      </AnimatePresence>
      <AnimatePresence>
        {fetchLandOpen && <FetchLandModal key="fetch-land" />}
      </AnimatePresence>
      <AnimatePresence>
        {scryOpen && <ScryModal key="scry" />}
      </AnimatePresence>
      <AnimatePresence>
        {realCountersId && <CountersModal key="counters" />}
      </AnimatePresence>
      <AnimatePresence>
        {setPTId && <SetPTModal key="set-pt" />}
      </AnimatePresence>
      <AnimatePresence>
        {proliferateOpen && <ProliferateModal key="proliferate" />}
      </AnimatePresence>

      {/* Reconnect banner (§57) */}
      <ReconnectBanner visible={justReconnected} />

      {/* Game over overlay (#75) */}
      <GameOverOverlay />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Inner component: solo mode (no server, local MTGCore reducer) ─────────────

function TabletopSolo() {
  const mySeat = useGameStore((s) => s.mySeat)
  const playStarted = useGameStore((s) => s.playStarted)
  const setPlayStarted = useGameStore((s) => s.setPlayStarted)
  // Reset the pre-game flow when leaving the table so re-entering /play shows mode-select again.
  useEffect(() => () => setPlayStarted(false), [setPlayStarted])

  const cardMenuCardId = useGameStore((s) => s.ui.cardMenuCardId)
  const inspectCardId  = useGameStore((s) => s.ui.inspectCardId)
  const viewerZone     = useGameStore((s) => s.ui.viewerZone)
  const tutorOpen      = useGameStore((s) => s.ui.tutorOpen)
  const fetchLandOpen  = useGameStore((s) => s.ui.fetchLandOpen)
  const scryOpen       = useGameStore((s) => s.ui.scryOpen)
  const countersId     = useGameStore((s) => s.ui.countersModalCardId)
  const setPTId        = useGameStore((s) => s.ui.setPTModalCardId)
  const pileMenuZone   = useGameStore((s) => s.ui.pileMenuZone)

  const gameState = useGameStore((s) => s.gameState)
  const menuCard: import("../types/game").CardInstance | null = cardMenuCardId ? (gameState?.cards[cardMenuCardId] ?? null) : null
  const isHandCard = menuCard?.zone === 'hand'

  const proliferateOpen = countersId === '::proliferate'
  const realCountersId  = (countersId && countersId !== '::proliferate') ? countersId : null

  if (!playStarted) return <PlayEntry />

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--navy)' }}>
      {/* MockGameLoader active in solo mode */}
      <MockGameLoader />

      <Board />
      <HandZone seat={mySeat} />
      <PanelShell />
      <StackPanel />
      <ArrowLayer />
      <CombatPanel />
      <OpeningHandModal />
      <SelfLifePanel />
      <HoverPreview />
      <HealthCluster mySeat={mySeat} />

      <Link
        to="/lobby"
        style={{
          position: 'fixed', top: 52, left: 10, zIndex: 51,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 9px', borderRadius: 'var(--r-sm)',
          background: 'var(--glass)', backdropFilter: 'blur(10px)',
          border: '1px solid var(--hairline)', color: 'var(--faint)',
          textDecoration: 'none', fontSize: 11,
          fontFamily: 'var(--font-body)', fontWeight: 600,
          letterSpacing: '0.04em', transition: 'color 150ms, border-color 150ms',
        }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.color = 'var(--paper)'; el.style.borderColor = 'rgba(77,163,255,0.4)' }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.color = 'var(--faint)'; el.style.borderColor = 'var(--hairline)' }}
      >
        <ArrowLeft size={11} strokeWidth={2.5} />
        Lobby
      </Link>

      <AnimatePresence>
        {cardMenuCardId && !isHandCard && <CardMenu key="card-menu" />}
      </AnimatePresence>
      <AnimatePresence>
        {cardMenuCardId && isHandCard && <HandMenu key="hand-menu" />}
      </AnimatePresence>
      <AnimatePresence>
        {pileMenuZone && <PileMenu key="pile-menu" />}
      </AnimatePresence>
      <AnimatePresence>
        {inspectCardId && <InspectModal key="inspect" />}
      </AnimatePresence>
      <AnimatePresence>
        {viewerZone && <ZoneViewer key="zone-viewer" />}
      </AnimatePresence>
      <AnimatePresence>
        {tutorOpen && <TutorModal key="tutor" />}
      </AnimatePresence>
      <AnimatePresence>
        {fetchLandOpen && <FetchLandModal key="fetch-land" />}
      </AnimatePresence>
      <AnimatePresence>
        {scryOpen && <ScryModal key="scry" />}
      </AnimatePresence>
      <AnimatePresence>
        {realCountersId && <CountersModal key="counters" />}
      </AnimatePresence>
      <AnimatePresence>
        {setPTId && <SetPTModal key="set-pt" />}
      </AnimatePresence>
      <AnimatePresence>
        {proliferateOpen && <ProliferateModal key="proliferate" />}
      </AnimatePresence>
    </div>
  )
}

// ── Root Tabletop: reads ?roomId and mounts the appropriate inner component ───

export default function Tabletop() {
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('roomId')

  // Render online or solo component based on whether roomId is in the URL.
  // We split into two components so useRoom() is ONLY called in online mode
  // (hooks must not be called conditionally).
  if (roomId) {
    return <TabletopOnline roomId={roomId} />
  }
  return <TabletopSolo />
}

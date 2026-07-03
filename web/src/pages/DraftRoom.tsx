/**
 * Sigil — /lobby/:gameId — Draft-select + spectate page (§55, §56, §57, §58)
 *
 * Joins the Colyseus room to sync seat/deck/bracket state.
 * Reconnect indicator (§57): shows ReconnectBanner for 3s on reconnect.
 * Spectate (§56): ?spectate=1 → read-only; SpectatorBanner shown.
 * Chat (§58): ChatPanel wired to Colyseus 'chat' messages.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Colyseus from 'colyseus.js'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { recordGameResult } from '../lib/matchHistory'
import DraftSelect, { type SeatInfo } from '../components/lobby/DraftSelect'
import SpectatorBanner from '../components/lobby/SpectatorBanner'
import ReconnectBanner from '../components/lobby/ReconnectBanner'
import ChatPanel, { type ChatMessage } from '../components/chat/ChatPanel'
import { MessageCircle } from 'lucide-react'

const SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567'

interface RoomSeatState {
  seat: number
  displayName: string
  connected: boolean
  deckName?: string
  bracketNumber?: number
  bracketSubRating?: 'U' | 'L' | null
  lockedIn: boolean
  isHost: boolean
}

let chatSeq = 0
function makeChatId() { return `chat-${++chatSeq}` }

export default function DraftRoom() {
  const { gameId }         = useParams<{ gameId: string }>()
  const [searchParams]     = useSearchParams()
  const isSpectator        = searchParams.get('spectate') === '1'
  const { user, playerName, isGuest } = useAuth()
  const navigate           = useNavigate()

  const roomRef            = useRef<Colyseus.Room | null>(null)
  const clientRef          = useRef<Colyseus.Client | null>(null)
  const reconnectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On return from /decks?pickFor=<gameId>, the deck name is in ?deck=
  const returnedDeck = searchParams.get('deck')

  const [seats, setSeats]            = useState<SeatInfo[]>([])
  const [totalSeats, setTotalSeats]  = useState(4)
  const [localSeat, setLocalSeat]    = useState<number>(-1)
  const [localDeckName, setLocalDeckName] = useState<string | undefined>()
  const [messages, setMessages]      = useState<ChatMessage[]>([])
  const [chatOpen, setChatOpen]      = useState(false)
  const [unread, setUnread]          = useState(0)
  const [reconnected, setReconnected] = useState(false)
  const [status, setStatus]          = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [error, setError]            = useState<string | null>(null)

  // Connect/join
  const connect = useCallback(async () => {
    if (!gameId) return
    setStatus('connecting')
    try {
      const client = new Colyseus.Client(SERVER_URL)
      clientRef.current = client

      let room: Colyseus.Room
      if (isSpectator) {
        room = await client.joinById(gameId, { displayName: playerName, spectator: true })
      } else {
        room = await client.joinById(gameId, { displayName: playerName })
      }

      roomRef.current = room
      setStatus('connected')

      // State sync
      room.onStateChange((state: unknown) => {
        const s = state as {
          seats?: number
          players?: Map<string, RoomSeatState>
        }
        if (s.seats) setTotalSeats(s.seats)

        if (s.players) {
          const seatList: SeatInfo[] = []
          for (const [, p] of s.players) {
            seatList.push({
              seat: p.seat,
              displayName: p.displayName,
              isLocal: p.displayName === playerName && !isSpectator,
              isHost: p.isHost,
              connected: p.connected,
              deckName: p.deckName,
              bracketResult: p.bracketNumber != null
                ? {
                    bracket: p.bracketNumber as 1|2|3|4|5,
                    subRating: p.bracketSubRating ?? null,
                    gameChangerCount: 0,
                    massLandDenialCount: 0,
                    extraTurnCount: 0,
                    tutorCount: 0,
                    fastManaCount: 0,
                    infiniteComboCount: 0,
                    totalCards: 0,
                    colorPercent: {},
                    typeCount: {},
                    flags: { gameChangers: false, massLandDenial: false, extraTurns: false, tutorDensity: false, infiniteCombos: false, fastMana: false },
                    upgradeSuggestions: [],
                  }
                : undefined,
              lockedIn: p.lockedIn,
            })
            if (p.displayName === playerName && !isSpectator) {
              setLocalSeat(p.seat)
            }
          }
          seatList.sort((a, b) => a.seat - b.seat)
          setSeats(seatList)
        }
      })

      // Chat messages
      room.onMessage<{ senderName: string; text: string; isSystem?: boolean }>('chat', (msg) => {
        const chatMsg: ChatMessage = {
          id: makeChatId(),
          senderName: msg.senderName,
          text: msg.text,
          sentAt: Date.now(),
          isSystem: msg.isSystem,
        }
        setMessages((prev) => [...prev, chatMsg])
        if (!chatOpen) setUnread((n) => n + 1)
      })

      // Game started → navigate to /play
      room.onMessage<{ gameId: string }>('gameStarted', ({ gameId: gid }) => {
        navigate(`/play?roomId=${gid}`)
      })

      // Game over → record match + ELO (#75)
      room.onMessage<{
        winnerSeat: number
        placements: Array<{ seat: number; userId: string; displayName: string; place: number }>
      }>('gameOver', async (msg) => {
        // Only the signed-in local player writes to Supabase (server stays out)
        if (!user?.id) return
        try {
          await recordGameResult({
            gameId: gameId ?? 'unknown',
            participants: msg.placements.map((p) => ({
              userId: p.userId || p.displayName,  // fallback for guests
              displayName: p.displayName,
              won: p.seat === msg.winnerSeat,
            })),
          })
        } catch (e) {
          console.warn('[DraftRoom] recordGameResult failed', e)
        }
      })

      room.onLeave(() => {
        setStatus('connecting')
        // Attempt reconnect
        setTimeout(() => {
          if (roomRef.current) return // already reconnected
          connect().then(() => {
            setReconnected(true)
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = setTimeout(() => setReconnected(false), 3000)
          })
        }, 1500)
      })

      room.onError((code, msg) => {
        console.error('[DraftRoom] error', code, msg)
        setError(`Connection error (${code})`)
        setStatus('error')
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStatus('error')
    }
  }, [gameId, playerName, isSpectator, chatOpen, navigate])

  // If we returned from /decks with a ?deck= param, use that deck name
  useEffect(() => {
    if (returnedDeck) {
      setLocalDeckName(returnedDeck)
    }
  }, [returnedDeck])

  useEffect(() => {
    connect()
    return () => {
      roomRef.current?.leave()
      roomRef.current = null
    }
  }, []) // mount only

  const sendChat = useCallback((text: string) => {
    roomRef.current?.send('chat', { text })
    // Optimistic local echo
    setMessages((prev) => [
      ...prev,
      { id: makeChatId(), senderName: playerName, text, sentAt: Date.now() },
    ])
  }, [playerName])

  const handleSelectDeck = useCallback(async () => {
    // Opens deck picker — for now navigate to /decks with a callback param
    // In a full build this would be an inline modal
    navigate(`/decks?pickFor=${gameId}`)
  }, [navigate, gameId])

  const handleLockIn = useCallback(() => {
    roomRef.current?.send('intent', {
      type: 'lockIn',
      deckName: localDeckName,
    })
  }, [localDeckName])

  const handleStartGame = useCallback(() => {
    roomRef.current?.send('intent', { type: 'startGame' })
  }, [])

  const handleChatOpen = () => {
    setChatOpen((o) => !o)
    if (!chatOpen) setUnread(0)
  }

  if (status === 'connecting') {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--brand)' }}
        />
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Joining table…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-center px-4">
        <p className="font-bold text-lg" style={{ color: 'var(--paper)' }}>Couldn't connect</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
        <button onClick={connect} className="px-6 py-2.5 font-bold text-sm"
          style={{ borderRadius: 'var(--r-md)', background: 'var(--brand)', color: '#04101f' }}>
          Retry
        </button>
      </div>
    )
  }

  const localSeatInfo = seats.find((s) => s.isLocal)

  return (
    <div className="relative min-h-screen">
      {isSpectator && <SpectatorBanner />}
      <ReconnectBanner visible={reconnected} />

      <DraftSelect
        seats={seats}
        totalSeats={totalSeats}
        isSpectator={isSpectator}
        onSelectDeck={handleSelectDeck}
        onLockIn={handleLockIn}
        onStartGame={handleStartGame}
        localDeckName={localDeckName}
        localBracket={localSeatInfo?.bracketResult}
      />

      {/* Chat toggle button */}
      <button
        onClick={handleChatOpen}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 flex items-center justify-center rounded-full shadow-lg"
        style={{
          background: 'var(--glass)',
          border: '1px solid var(--hairline)',
          backdropFilter: 'blur(12px)',
          color: 'var(--brand-bright)',
        }}
        title="Chat"
      >
        <MessageCircle size={20} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: 'var(--brand)', color: '#04101f' }}
          >
            {unread}
          </span>
        )}
      </button>

      <ChatPanel
        messages={messages}
        onSend={sendChat}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        unreadCount={unread}
        room={roomRef.current}
        mySeat={localSeat >= 0 ? localSeat : 0}
        totalSeats={totalSeats}
      />
    </div>
  )
}

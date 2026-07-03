/**
 * Sigil — In-game + lobby text chat (§58)
 *
 * Strategy: Colyseus room messages for in-game chat (room scoped);
 * Supabase Realtime broadcast for lobby chat (no room needed).
 * Voice/audio is stubbed behind VOICE_CHAT_ENABLED flag — needs TURN server (human gate).
 *
 * TODO(voice): Set VITE_VOICE_CHAT_ENABLED=true and wire a TURN/ICE server
 * (e.g. Metered.ca, Twilio TURN) before enabling. The UI stub below renders
 * a disabled mic button with an explanatory tooltip when the flag is false.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Mic, MicOff, MessageCircle, X } from 'lucide-react'
import { useVoiceMesh } from '../../lib/voice'
import type Colyseus from 'colyseus.js'

// Voice chat is disabled until a TURN server is configured (human gate §8)
const VOICE_CHAT_ENABLED = import.meta.env.VITE_VOICE_CHAT_ENABLED === 'true'

export interface ChatMessage {
  id: string
  senderName: string
  text: string
  sentAt: number
  isSystem?: boolean
}

interface Props {
  /** Messages to display */
  messages: ChatMessage[]
  /** Called when user sends a message */
  onSend: (text: string) => void
  /** Show/hide the panel */
  open: boolean
  onClose?: () => void
  /** Compact mode = no header, inline in a sidebar */
  inline?: boolean
  unreadCount?: number
  /** Colyseus room for voice signalling (#76) */
  room?: Colyseus.Room | null
  /** Local seat number for voice mesh */
  mySeat?: number
  /** Total seats in the game */
  totalSeats?: number
}

export default function ChatPanel({ messages, onSend, open, onClose, inline, unreadCount, room = null, mySeat = 0, totalSeats = 4 }: Props) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  // Voice mesh (#76) — no-op when VITE_VOICE_CHAT_ENABLED is not set
  const { muted, toggleMute, active: voiceActive } = useVoiceMesh({
    room,
    mySeat,
    totalSeats,
    enabled: VOICE_CHAT_ENABLED,
  })

  // Auto-scroll on new messages
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const send = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }, [text, onSend])

  const panel = (
    <div
      className="flex flex-col"
      style={{
        height: inline ? '100%' : 360,
        width: inline ? '100%' : 320,
        borderRadius: inline ? 0 : 'var(--r-lg)',
        border: inline ? 'none' : '1px solid var(--hairline)',
        background: 'var(--glass)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
      }}
    >
      {/* Header (non-inline only) */}
      {!inline && (
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--hairline)' }}
        >
          <div className="flex items-center gap-2">
            <MessageCircle size={14} color="var(--brand-bright)" />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--paper)' }}>
              Chat
            </span>
            {(unreadCount ?? 0) > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--brand)', color: '#04101f' }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Voice toggle (#76) */}
            <button
              onClick={VOICE_CHAT_ENABLED ? toggleMute : undefined}
              title={
                !VOICE_CHAT_ENABLED
                  ? 'Voice chat requires VITE_VOICE_CHAT_ENABLED=true + TURN server (human gate)'
                  : !voiceActive
                  ? 'Voice: not connected'
                  : muted ? 'Unmute mic' : 'Mute mic'
              }
              disabled={!VOICE_CHAT_ENABLED || !voiceActive}
              className="w-7 h-7 flex items-center justify-center rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: (VOICE_CHAT_ENABLED && !muted) ? 'var(--brand-bright)' : 'var(--muted)' }}
            >
              {VOICE_CHAT_ENABLED && !muted ? <Mic size={14} /> : <MicOff size={14} />}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-sm transition-colors"
                style={{ color: 'var(--muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1" style={{ fontSize: '0.8125rem' }}>
        {messages.length === 0 && (
          <p className="text-center py-4" style={{ color: 'var(--faint)', fontSize: '0.75rem' }}>
            No messages yet.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={msg.isSystem ? 'text-center' : ''}>
            {msg.isSystem ? (
              <span style={{ color: 'var(--faint)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                {msg.text}
              </span>
            ) : (
              <span>
                <span className="font-bold" style={{ color: 'var(--brand-bright)' }}>
                  {msg.senderName}:&nbsp;
                </span>
                <span style={{ color: 'var(--paper)' }}>{msg.text}</span>
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderTop: '1px solid var(--hairline)' }}
      >
        <input
          type="text"
          placeholder="Say something…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--paper)' }}
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="w-7 h-7 flex items-center justify-center rounded-sm transition-colors disabled:opacity-30"
          style={{ color: 'var(--brand-bright)' }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )

  if (inline) return panel

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-20 right-4 z-50 shadow-2xl"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          {panel}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

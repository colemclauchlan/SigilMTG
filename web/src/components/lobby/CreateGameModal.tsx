/**
 * Sigil — Create Game modal (§54)
 * Host a table: name, seat count (2-4), game mode, manual/auto engine.
 */
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { createRoom } from '../../lib/net'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

interface Props {
  onClose: () => void
  serverUrl: string
}

export default function CreateGameModal({ onClose, serverUrl }: Props) {
  const { playerName } = useAuth()
  const [gameName, setGameName] = useState(`${playerName}'s Table`)
  const [seats, setSeats]       = useState(4)
  const [manual, setManual]     = useState(false)
  const [working, setWorking]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 'var(--r-md)',
    background: 'var(--ink-3)', border: '1px solid var(--hairline)',
    color: 'var(--paper)', fontSize: '0.875rem', outline: 'none',
  }

  const handleCreate = useCallback(async () => {
    setWorking(true)
    setError(null)
    try {
      const roomId = await createRoom(serverUrl, {
        displayName: playerName,
        manual,
      })

      // Persist open table in Supabase so others can find it
      await supabase.from('games').upsert({
        id: roomId,
        name: gameName,
        status: 'open',
        seats,
        manual_mode: manual,
        host_name: playerName,
      }, { onConflict: 'id' })

      // Navigate to the draft-select screen
      window.location.href = `/lobby/${roomId}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
      setWorking(false)
    }
  }, [serverUrl, playerName, gameName, seats, manual])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,16,31,0.80)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="w-full max-w-sm flex flex-col gap-5 p-6"
        style={{
          borderRadius: 'var(--r-xl)', border: '1px solid var(--hairline)',
          background: 'var(--glass)', backdropFilter: 'blur(18px)',
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg tracking-wide" style={{ color: 'var(--paper)' }}>
            Host a Table
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-sm" style={{ color: 'var(--muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>Table Name</span>
            <input style={inputStyle} value={gameName} onChange={(e) => setGameName(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>Seats</span>
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button key={n} onClick={() => setSeats(n)}
                  className="flex-1 py-2 text-sm font-bold transition-all"
                  style={{
                    borderRadius: 'var(--r-md)',
                    border: `1px solid ${seats === n ? 'var(--brand)' : 'var(--hairline)'}`,
                    color: seats === n ? 'var(--brand-bright)' : 'var(--muted)',
                    background: seats === n ? 'var(--brand-soft)' : 'var(--ink-3)',
                  }}>
                  {n}P
                </button>
              ))}
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-xs font-bold tracking-wide uppercase flex-1" style={{ color: 'var(--muted)' }}>
              Manual Engine Mode
            </span>
            <div
              onClick={() => setManual((m) => !m)}
              className="w-10 h-5 rounded-full transition-colors relative cursor-pointer"
              style={{ background: manual ? 'var(--brand)' : 'var(--ink-3)', border: '1px solid var(--hairline)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                style={{ background: 'var(--paper)', left: manual ? 'calc(100% - 18px)' : '2px' }}
              />
            </div>
          </label>
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

        <button
          onClick={handleCreate}
          disabled={working || !gameName.trim()}
          className="flex items-center justify-center gap-2 w-full py-3 font-bold text-sm tracking-wide disabled:opacity-50"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))',
            color: '#04101f',
          }}
        >
          <Plus size={16} />
          {working ? 'Creating…' : 'Create Table'}
        </button>
      </motion.div>
    </div>
  )
}

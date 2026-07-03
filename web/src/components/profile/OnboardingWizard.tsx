/**
 * Sigil — 3-step onboarding wizard (§52)
 * Steps: 1) Set display name + avatar initial
 *        2) Import/select your first deck
 *        3) Invite a friend / go to lobby
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Check, Swords, Users, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { upsertProfile } from '../../lib/matchHistory'
import { useAuth } from '../../lib/auth'

interface Props {
  onComplete: () => void
}

const STEPS = [
  { icon: <BookOpen size={22} />, label: 'Your Name' },
  { icon: <Swords size={22} />, label: 'First Deck' },
  { icon: <Users size={22} />, label: 'Play!' },
]

export default function OnboardingWizard({ onComplete }: Props) {
  const { user, playerName } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [displayName, setDisplayName] = useState(playerName ?? '')
  const [saving, setSaving] = useState(false)

  const stepVariants = {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
    exit:   { opacity: 0, x: -40 },
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 'var(--r-md)',
    background: 'var(--ink-3)', border: '1px solid var(--hairline)',
    color: 'var(--paper)', fontSize: '0.9rem', outline: 'none',
  }

  async function handleStep0() {
    if (!displayName.trim()) return
    setSaving(true)
    if (user) await upsertProfile(user.id, { display_name: displayName.trim() })
    setSaving(false)
    setStep(1)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,16,31,0.88)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
        style={{
          borderRadius: 'var(--r-xl)', border: '1px solid var(--hairline)',
          background: 'var(--glass)', backdropFilter: 'blur(18px)',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        <div className="flex" style={{ borderBottom: '1px solid var(--hairline)' }}>
          {STEPS.map((s, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold tracking-widest uppercase transition-colors"
              style={{
                color: i === step ? 'var(--brand-bright)' : i < step ? 'var(--success)' : 'var(--faint)',
                borderBottom: i === step ? '2px solid var(--brand)' : '2px solid transparent',
              }}
            >
              {i < step ? <Check size={16} /> : s.icon}
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="p-8" style={{ minHeight: 260 }}>
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" variants={stepVariants} initial="hidden" animate="visible" exit="exit"
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-5">
                <div>
                  <h2 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--paper)' }}>
                    Welcome to Sigil!
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    What should we call you at the table?
                  </p>
                </div>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStep0()}
                  autoFocus
                />
                <button
                  onClick={handleStep0}
                  disabled={!displayName.trim() || saving}
                  className="flex items-center justify-center gap-2 w-full py-3 font-bold text-sm tracking-wide disabled:opacity-50"
                  style={{
                    borderRadius: 'var(--r-md)',
                    background: 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))',
                    color: '#04101f',
                  }}
                >
                  {saving ? 'Saving…' : 'Continue'} <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" variants={stepVariants} initial="hidden" animate="visible" exit="exit"
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-5">
                <div>
                  <h2 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--paper)' }}>
                    Add Your First Deck
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    Import a decklist or browse precons to get started.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { navigate('/decks'); onComplete() }}
                    className="w-full py-3 font-bold text-sm tracking-wide"
                    style={{
                      borderRadius: 'var(--r-md)',
                      background: 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))',
                      color: '#04101f',
                    }}
                  >
                    Go to Deck Builder
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="w-full py-3 font-bold text-sm tracking-wide"
                    style={{
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--hairline)',
                      color: 'var(--muted)',
                    }}
                  >
                    Skip for now
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={stepVariants} initial="hidden" animate="visible" exit="exit"
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-5 items-center text-center">
                <div
                  className="w-16 h-16 flex items-center justify-center"
                  style={{ borderRadius: '50%', background: 'var(--brand-soft)' }}
                >
                  <Users size={28} color="var(--brand-bright)" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--paper)' }}>
                    You're ready!
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    Find a table in the Lobby, invite friends, or jump into a solo game.
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => { navigate('/lobby'); onComplete() }}
                    className="w-full py-3 font-bold text-sm tracking-wide"
                    style={{
                      borderRadius: 'var(--r-md)',
                      background: 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))',
                      color: '#04101f',
                    }}
                  >
                    Go to Lobby
                  </button>
                  <button
                    onClick={onComplete}
                    className="w-full py-3 text-sm"
                    style={{ color: 'var(--faint)' }}
                  >
                    Maybe later
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

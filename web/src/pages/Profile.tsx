/**
 * Sigil — Profile page (§51, §52, §53, §83)
 *
 * Routes:
 *   /profile      → own profile (or sign-in if unauthenticated)
 *   /profile/:id  → another user's profile (read-only)
 *
 * §83 additions:
 *   - Badges grid: earned/locked state, tier color, tooltip, icon
 *   - Fetches full catalog + user_achievements for the profile user
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, LogIn, LogOut, Edit2, Check, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchProfile, upsertProfile, type ProfileRow } from '../lib/matchHistory'
import {
  fetchCatalog,
  fetchUserAchievements,
  type Achievement,
  type UserAchievement,
} from '../lib/achievements'
import MatchHistoryPanel from '../components/profile/MatchHistoryPanel'
import OnboardingWizard from '../components/profile/OnboardingWizard'

const ONBOARDING_KEY = 'sigil:onboardingDone'

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 'var(--r-md)',
  background: 'var(--ink-3)', border: '1px solid var(--hairline)',
  color: 'var(--paper)', fontSize: '0.875rem', outline: 'none',
}

const cardStyle: React.CSSProperties = {
  borderRadius: 'var(--r-xl)', border: '1px solid var(--hairline)',
  background: 'var(--glass)', backdropFilter: 'blur(16px)',
}

// ── Tier styling ──────────────────────────────────────────────────────────────
const TIER_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  bronze:   { bg: 'rgba(180,100,40,0.18)',  border: '#b46428', label: '#d4a574' },
  silver:   { bg: 'rgba(160,170,185,0.18)', border: '#8899aa', label: '#c0ccd8' },
  gold:     { bg: 'rgba(230,190,50,0.18)',  border: '#d4a017', label: '#f5cc44' },
  platinum: { bg: 'rgba(100,200,255,0.15)', border: '#5bc8e8', label: '#a0e8ff' },
}

// ── Badge card ────────────────────────────────────────────────────────────────
function BadgeCard({
  ach,
  earned,
  earnedAt,
}: {
  ach: Achievement
  earned: boolean
  earnedAt?: string
}) {
  const [showTip, setShowTip] = useState(false)
  const tier = TIER_COLORS[ach.tier] ?? TIER_COLORS.bronze

  return (
    <div
      className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-default select-none transition-all duration-200"
      style={{
        background: earned ? tier.bg : 'var(--ink-3)',
        border: `1px solid ${earned ? tier.border : 'var(--hairline)'}`,
        opacity: earned ? 1 : 0.45,
        minWidth: 72,
      }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      {/* Icon */}
      <span
        className="text-2xl"
        style={{ filter: earned ? 'none' : 'grayscale(1)' }}
        role="img"
        aria-label={ach.name}
      >
        {ach.icon}
      </span>

      {/* Name */}
      <span
        className="text-center font-bold leading-tight"
        style={{
          fontSize: '0.6rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: earned ? tier.label : 'var(--muted)',
          maxWidth: 64,
        }}
      >
        {ach.name}
      </span>

      {/* Tooltip */}
      {showTip && (
        <div
          className="absolute bottom-full mb-2 left-1/2 z-50 px-3 py-2 rounded-lg text-xs w-44 text-center pointer-events-none"
          style={{
            transform: 'translateX(-50%)',
            background: 'var(--ink)',
            border: '1px solid var(--hairline)',
            color: 'var(--paper-dim)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <p className="font-bold mb-0.5" style={{ color: 'var(--paper)' }}>{ach.name}</p>
          <p>{ach.description}</p>
          {earned && earnedAt && (
            <p className="mt-1" style={{ color: 'var(--muted)', fontSize: '0.65rem' }}>
              Earned {new Date(earnedAt).toLocaleDateString()}
            </p>
          )}
          {!earned && (
            <p className="mt-1" style={{ color: 'var(--faint)', fontSize: '0.65rem' }}>Locked</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Badges section ────────────────────────────────────────────────────────────
function BadgesGrid({ userId }: { userId: string }) {
  const [catalog, setCatalog] = useState<Achievement[]>([])
  const [earned, setEarned]   = useState<UserAchievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchCatalog(), fetchUserAchievements(userId)]).then(([cat, ua]) => {
      setCatalog(cat)
      setEarned(ua)
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4" style={{ color: 'var(--muted)' }}>
        <span className="text-xs">Loading badges…</span>
      </div>
    )
  }

  if (catalog.length === 0) return null  // table not yet migrated — hide section silently

  const earnedMap = new Map<string, string>()  // achievement_id → earned_at
  for (const ua of earned) {
    earnedMap.set(ua.achievement_id, ua.earned_at)
  }

  const earnedCount = earned.length

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg tracking-wide" style={{ color: 'var(--paper)' }}>
          Badges
        </h2>
        <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
          {earnedCount} / {catalog.length}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="p-4 flex flex-wrap gap-3"
        style={cardStyle}
      >
        {catalog.map((ach) => (
          <BadgeCard
            key={ach.id}
            ach={ach}
            earned={earnedMap.has(ach.id)}
            earnedAt={earnedMap.get(ach.id)}
          />
        ))}
      </motion.div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Profile() {
  const { id: routeId } = useParams<{ id?: string }>()
  const { user, playerName, isGuest, signInWithEmail, signUp, signOut, setGuestName, enterGuestMode } = useAuth()
  // useNavigate kept for future use; suppress lint with void
  void useNavigate

  const viewingOwn = !routeId || routeId === user?.id
  const targetId   = routeId ?? user?.id

  const [profile, setProfile]           = useState<ProfileRow | null>(null)
  const [loadingProfile, setLoading]    = useState(false)
  const [editingName, setEditingName]   = useState(false)
  const [newName, setNewName]           = useState('')
  const [savingName, setSavingName]     = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Auth form state
  const [authTab, setAuthTab]    = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]        = useState('')
  const [password, setPassword]  = useState('')
  const [displayName, setDisplayName] = useState('')
  const [authError, setAuthError]    = useState<string | null>(null)
  const [working, setWorking]        = useState(false)

  useEffect(() => {
    if (!targetId) return
    setLoading(true)
    fetchProfile(targetId).then((p) => {
      setProfile(p)
      setLoading(false)
      if (viewingOwn && user && !sessionStorage.getItem(ONBOARDING_KEY) && !p?.wins && !p?.losses) {
        setShowOnboarding(true)
      }
    })
  }, [targetId, user, viewingOwn])

  const handleSaveName = async () => {
    if (!user || !newName.trim()) return
    setSavingName(true)
    await upsertProfile(user.id, { display_name: newName.trim() })
    setProfile((p) => p ? { ...p, display_name: newName.trim() } : p)
    setSavingName(false)
    setEditingName(false)
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setWorking(true)
    const result = authTab === 'signin'
      ? await signInWithEmail(email, password)
      : await signUp(email, password, displayName)
    setWorking(false)
    if (result.error) setAuthError(result.error.message)
  }

  // ── Auth wall ──────────────────────────────────────────────────────────────
  if (!user && viewingOwn) {
    return (
      <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: 'calc(100dvh - 62px)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-10 flex flex-col gap-6 max-w-md w-full" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center" style={{ borderRadius: 'var(--r-lg)', background: 'var(--brand-soft)' }}>
              <User size={20} color="var(--brand-bright)" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-wide" style={{ color: 'var(--paper)' }}>
              {authTab === 'signin' ? 'Sign In' : 'Create Account'}
            </h1>
          </div>

          <div className="flex gap-2 p-1" style={{ borderRadius: 'var(--r-md)', background: 'var(--ink-3)' }}>
            {(['signin', 'signup'] as const).map((t) => (
              <button key={t} onClick={() => { setAuthTab(t); setAuthError(null) }}
                className="flex-1 py-2 text-xs font-bold tracking-widest uppercase transition-all"
                style={{
                  borderRadius: 'var(--r-sm)',
                  background: authTab === t ? 'var(--ink)' : 'transparent',
                  color: authTab === t ? 'var(--brand-bright)' : 'var(--muted)',
                }}>
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
            {authTab === 'signup' && (
              <input style={inputStyle} type="text" placeholder="Display name"
                value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            )}
            <input style={inputStyle} type="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input style={inputStyle} type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
            {authError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{authError}</p>}
            <button type="submit" disabled={working}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 font-bold text-sm tracking-wide transition-all disabled:opacity-60"
              style={{
                borderRadius: 'var(--r-md)',
                background: 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))',
                color: '#04101f',
              }}>
              <LogIn size={16} />
              {working ? 'Working…' : authTab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--hairline)' }} />
            <span className="text-xs" style={{ color: 'var(--faint)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--hairline)' }} />
          </div>

          {!isGuest ? (
            <button onClick={enterGuestMode}
              className="w-full px-6 py-3 font-bold text-sm transition-all"
              style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
              Continue as Guest
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Playing as guest. Set your name:</p>
              <input style={inputStyle} type="text" placeholder="Guest name"
                onChange={(e) => setGuestName(e.target.value)} />
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  // ── Profile view ───────────────────────────────────────────────────────────
  const displayedName = profile?.display_name ?? playerName
  const elo           = profile?.elo ?? 1200
  const wins          = profile?.wins ?? 0
  const losses        = profile?.losses ?? 0
  const winRate       = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null

  // suppress unused variable warning
  void loadingProfile

  return (
    <div
      className="flex flex-col items-center px-4 py-8 gap-6 max-w-lg mx-auto"
      style={{ minHeight: 'calc(100dvh - 62px)' }}
    >
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => {
            sessionStorage.setItem(ONBOARDING_KEY, 'true')
            setShowOnboarding(false)
          }}
        />
      )}

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="p-8 flex flex-col items-center gap-5 w-full"
        style={cardStyle}
      >
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-display font-bold"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand-bright)' }}
        >
          {displayedName[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Name + edit */}
        <div className="flex flex-col items-center gap-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                style={{ ...inputStyle, width: 180 }}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                autoFocus
              />
              <button onClick={handleSaveName} disabled={savingName}
                className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--success)' }}>
                <Check size={14} />
              </button>
              <button onClick={() => setEditingName(false)}
                className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--danger)' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-2xl tracking-wide" style={{ color: 'var(--paper)' }}>
                {displayedName}
              </h1>
              {viewingOwn && user && (
                <button
                  onClick={() => { setNewName(displayedName); setEditingName(true) }}
                  className="w-6 h-6 flex items-center justify-center"
                  style={{ color: 'var(--muted)' }}
                  title="Edit name"
                >
                  <Edit2 size={12} />
                </button>
              )}
            </div>
          )}
          {user && viewingOwn && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{user.email}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-display font-bold text-2xl" style={{ color: 'var(--brand-bright)' }}>
              {elo}
            </span>
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--faint)' }}>ELO</span>
          </div>
          <div className="w-px h-8" style={{ background: 'var(--hairline)' }} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-display font-bold text-2xl" style={{ color: 'var(--success)' }}>{wins}</span>
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--faint)' }}>Wins</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-display font-bold text-2xl" style={{ color: 'var(--danger)' }}>{losses}</span>
            <span className="text-xs uppercase tracking-widests" style={{ color: 'var(--faint)' }}>Losses</span>
          </div>
          {winRate != null && (
            <>
              <div className="w-px h-8" style={{ background: 'var(--hairline)' }} />
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-display font-bold text-2xl" style={{ color: 'var(--paper)' }}>{winRate}%</span>
                <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--faint)' }}>Win rate</span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {viewingOwn && user && (
          <button onClick={signOut}
            className="flex items-center gap-2 px-5 py-2 font-bold text-sm transition-colors"
            style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
            <LogOut size={14} /> Sign out
          </button>
        )}
      </motion.div>

      {/* Badges grid (§83) */}
      {targetId && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          <BadgesGrid userId={targetId} />
        </motion.div>
      )}

      {/* Match history */}
      {targetId && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex flex-col gap-4"
        >
          <h2 className="font-display font-bold text-lg tracking-wide" style={{ color: 'var(--paper)' }}>
            Match History
          </h2>
          <MatchHistoryPanel userId={targetId} />
        </motion.div>
      )}
    </div>
  )
}

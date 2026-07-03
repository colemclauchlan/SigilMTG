/**
 * Sigil — Auth context
 * Exposes: session, user, playerName, isGuest, signInWithEmail, signUp, signOut, setGuestName
 * playerName auto-populates from signed-in profile display_name or email prefix.
 * Guest mode sets a manual name stored in sessionStorage.
 */
import { createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null
  user: User | null
  playerName: string
  isGuest: boolean
  loading: boolean

  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>

  /** Guest mode: set a manual player name (stored in sessionStorage) */
  setGuestName: (name: string) => void
  /** Explicitly enter guest mode without signing in */
  enterGuestMode: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GUEST_NAME_KEY = 'sigil:guestName'
const GUEST_MODE_KEY = 'sigil:guestMode'

function emailToName(email: string): string {
  return email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [guestName, setGuestNameState] = useState<string>(
    () => sessionStorage.getItem(GUEST_NAME_KEY) ?? '',
  )
  const [isGuest, setIsGuest] = useState<boolean>(
    () => sessionStorage.getItem(GUEST_MODE_KEY) === 'true',
  )

  // Derive playerName
  const playerName = user
    ? (user.user_metadata?.display_name as string | undefined) ?? emailToName(user.email ?? '')
    : guestName || 'Guest'

  // Bootstrap session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
      if (sess?.user) {
        // Signed in — clear guest mode
        setIsGuest(false)
        sessionStorage.removeItem(GUEST_MODE_KEY)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName ?? emailToName(email) } },
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setIsGuest(false)
    sessionStorage.removeItem(GUEST_MODE_KEY)
    sessionStorage.removeItem(GUEST_NAME_KEY)
  }, [])

  const setGuestName = useCallback((name: string) => {
    setGuestNameState(name)
    sessionStorage.setItem(GUEST_NAME_KEY, name)
  }, [])

  const enterGuestMode = useCallback(() => {
    setIsGuest(true)
    sessionStorage.setItem(GUEST_MODE_KEY, 'true')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        playerName,
        isGuest,
        loading,
        signInWithEmail,
        signUp,
        signOut,
        setGuestName,
        enterGuestMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

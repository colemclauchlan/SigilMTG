import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import Nav from './components/Nav'
import Landing from './pages/Landing'
import Tabletop from './pages/Tabletop'
import Lobby from './pages/Lobby'
import DraftRoom from './pages/DraftRoom'
import Profile from './pages/Profile'
import Decks from './pages/Decks'
import Ranked from './pages/Ranked'
import Tournaments from './pages/Tournaments'
import Watch from './pages/Watch'
import SpectatorView from './pages/SpectatorView'
import Replay from './pages/Replay'
import ReplayList from './pages/ReplayList'
import LifeTracker from './pages/LifeTracker'
import DeckBuilder from './pages/DeckBuilder'

// Routes that should NOT have the Nav header
const NO_NAV_ROUTES = new Set(['/play'])
// Routes that hide nav by pathname prefix
function shouldShowNav(pathname: string) {
  if (NO_NAV_ROUTES.has(pathname)) return false
  if (pathname.startsWith('/lobby/')) return false  // draft-select is full-screen
  if (pathname.startsWith('/watch/')) return false   // spectator view is full-screen
  if (pathname.startsWith('/replay/')) return false  // VOD player is full-screen
  return true
}

function AppShell() {
  const location = useLocation()
  const showNav  = shouldShowNav(location.pathname)

  return (
    <div className={showNav ? 'app-shell relative z-10 flex flex-col min-h-dvh' : ''}>
      {showNav && <Nav />}
      <main className={showNav ? 'flex-1' : undefined}>
        <Routes>
          <Route path="/"                    element={<Landing />} />
          <Route path="/play"                element={<Tabletop />} />
          <Route path="/lobby"               element={<Lobby />} />
          <Route path="/lobby/:gameId"       element={<DraftRoom />} />
          <Route path="/profile"             element={<Profile />} />
          <Route path="/profile/:id"         element={<Profile />} />
          <Route path="/decks"               element={<Decks />} />
          <Route path="/build"               element={<DeckBuilder />} />
          <Route path="/life"                element={<LifeTracker />} />
          <Route path="/ranked"              element={<Ranked />} />
          <Route path="/tournaments"         element={<Tournaments />} />
          <Route path="/tournaments/:id"     element={<Tournaments />} />
          <Route path="/watch"               element={<Watch />} />
          <Route path="/watch/:gameId"       element={<SpectatorView />} />
          <Route path="/replays"             element={<ReplayList />} />
          <Route path="/replay/:id"          element={<Replay />} />
          <Route
            path="*"
            element={
              <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-62px)] gap-4 text-center px-4">
                <p className="font-display text-4xl font-bold" style={{ color: 'var(--brand-bright)' }}>404</p>
                <p style={{ color: 'var(--muted)' }}>Page not found.</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

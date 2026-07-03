# Phase 0 Scaffold — React Web Client + Game Server Skeleton

Created 2026-06-28. See `docs/PLATFORM_BUILD_PLAN_V2.md` §4 for context.

## What was created

```
web/                       ← Vite + React + TypeScript + Tailwind
  index.html
  vite.config.ts
  tsconfig.json / tsconfig.node.json
  tailwind.config.js
  postcss.config.js
  .gitignore               ← .env.local gitignored
  .env.local               ← VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (public anon key only)
  src/
    main.tsx               ← QueryClientProvider + BrowserRouter + App
    App.tsx                ← AuthProvider + Nav + Routes
    styles/
      tokens.css           ← Full Sigil design token set (ported from theme.css)
      globals.css          ← Tailwind directives + token import + body/scrollbar/keyframes
    lib/
      supabase.ts          ← createClient from Vite env vars
      auth.tsx             ← AuthContext: session/signIn/signUp/signOut/guest/playerName
    store/
      gameStore.ts         ← Zustand store: connectionStatus, snapshot, UI flags, autoMode
    components/
      Nav.tsx              ← Sticky nav: Sigil brand + route tabs + auth actions
    pages/
      Landing.tsx          ← Hero (foil SIGIL title) + features grid
      Tabletop.tsx         ← Phase 0 stub, shows server connection status
      Lobby.tsx            ← Phase 5 placeholder
      Profile.tsx          ← Working sign-in / sign-up / guest-mode form

server/                    ← Colyseus game server
  package.json
  tsconfig.json
  .gitignore
  README.md
  src/
    schema.ts              ← GameRoomState + PlayerState (@colyseus/schema)
    GameRoom.ts            ← Room: join/leave/intent dispatch (setLife, passTurn, test)
    index.ts               ← Express + Colyseus Server + GameRoom registration

PHASE0_SCAFFOLD.md         ← this file
```

## Dev commands

```bash
# React web app
cd web && npm install && npm run dev      # http://localhost:5173

# Game server
cd server && npm install && npm run dev   # ws://localhost:2567
```

## What is NOT touched

All existing vanilla files are untouched:
index.html, app.js, table.js, play-*.js, engine-*.js, rules-*.js, etc.

## Secrets

- `web/.env.local` holds the PUBLIC Supabase anon key only. Gitignored.
- No service_role key is written anywhere.
- Game server secrets (if needed) go in `server/.env` (gitignored).

# Sigil — Game Server

Server-authoritative Commander game rooms built on [Colyseus](https://colyseus.io/).

## Quick start

```bash
cd server
npm install
npm run dev        # tsx watch hot-reload on port 2567
```

## Dev endpoints

| Endpoint | Description |
|---|---|
| `ws://localhost:2567` | WebSocket — join a `game` room |
| `http://localhost:2567/health` | Health check (JSON) |
| `http://localhost:2567/colyseus` | Colyseus admin monitor (dev only) |

## Connect from the web client

The React app reads `VITE_GAME_SERVER_URL` from `web/.env.local`.
Default: `ws://localhost:2567`.

## Sending intents (client → server)

```ts
// Join a room
const room = await client.joinOrCreate('game', { displayName: 'Cole' })

// Send an intent
room.send('intent', { type: 'test', payload: { hello: 'world' } })
room.send('intent', { type: 'setLife', delta: -3 })
room.send('intent', { type: 'passTurn' })
```

## Engine seam (Phase 3)

`src/GameRoom.ts` and `src/index.ts` have `// TODO ENGINE` comments where
the existing `engine-*.js` / `rules-*.js` modules will plug in as a
transport-agnostic TS package at `engine/src/index.ts`.

## Deploy (Phase 5)

Fly.io is the recommended host for low-latency WebSocket rooms.
See `PLATFORM_BUILD_PLAN_V2.md §8` for human gates.

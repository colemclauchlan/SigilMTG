/**
 * Sigil — Game Server entry point
 *
 * Stack: Colyseus 0.15 + Express
 * Dev:   npm run dev       (tsx watch — hot reload)
 * Prod:  npm run build && npm start
 *
 * Default port: 2567 (Colyseus default; override with PORT env var)
 *
 * Admin monitor (dev):  http://localhost:2567/colyseus
 * Install @colyseus/monitor separately if you want the full UI panel:
 *   npm install @colyseus/monitor
 */
import http from 'http'
import express from 'express'
import cors from 'cors'
import { Server } from 'colyseus'
import { GameRoom } from './GameRoom.js'

// ── Express app ──────────────────────────────────────────────────────────────

const app = express()

app.use(cors({
  origin: [
    'http://localhost:5173',    // Vite dev
    'http://localhost:4173',    // Vite preview
    process.env['WEB_ORIGIN'] ?? '*',
  ],
  credentials: true,
}))

app.use(express.json())

// Health check (Fly.io / Railway / Render)
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sigil-game-server', ts: Date.now() })
})

// ── HTTP + WebSocket server ──────────────────────────────────────────────────

const httpServer = http.createServer(app)

const gameServer = new Server({ server: httpServer })

// Register the GameRoom — options type is Record<string,unknown> in Colyseus 0.15
gameServer.define('game', GameRoom)

// ── Boot ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env['PORT'] ?? 2567)

gameServer.listen(PORT, "0.0.0.0").then(() => {
  const lines = [
    '╔═══════════════════════════════════════════╗',
    `║   Sigil Game Server  ·  port ${PORT}        ║`,
    `║   WS:   ws://localhost:${PORT}             ║`,
    `║   HTTP: http://localhost:${PORT}/health    ║`,
    '╚═══════════════════════════════════════════╝',
  ]
  console.log(lines.join('\n'))
}).catch((err: unknown) => {
  console.error('[Sigil] Server failed to start:', err)
  process.exit(1)
})

// ── TODO ENGINE mount points ──────────────────────────────────────────────
// When the engine/ shared package is ready (Phase 3), import here:
//
//   import { EngineCore } from '../../engine/src/index.js'
//
// The GameRoom already has TODO ENGINE seams for:
//   - createInitialState() on room create
//   - SBA check after life change
//   - turn automaton on passTurn

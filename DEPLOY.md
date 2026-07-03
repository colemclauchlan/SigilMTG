# Sigil — Turnkey Deploy Guide

Two independent deploys: **A) game server → Fly.io**, **B) React web app → Vercel**.
The root `vercel.json` (in this directory) is for the *separate* vanilla app — leave it alone.

---

## Prerequisites

```bash
# Install CLIs (once)
npm install -g flyctl vercel
flyctl auth login
vercel login
```

---

## A. Game Server → Fly.io (Colyseus WebSocket)

```bash
cd server

# First deploy only: import fly.toml and create the app
flyctl launch --no-deploy
# When prompted, answer:
#   App name:   sigil-game-server   (or whatever you like)
#   Region:     iad (US-East) or closest to you
#   Postgres:   No
#   Redis:      No
# This reads the existing fly.toml — do NOT overwrite it when asked.

# Set the CORS origin secret (your Vercel URL — get it after step B)
flyctl secrets set WEB_ORIGIN=https://your-app.vercel.app

# Deploy
flyctl deploy
```

**What you get:** `wss://sigil-game-server.fly.dev`
(Replace `sigil-game-server` with your chosen app name if you changed it.)

**Verify it's live:**
```bash
curl https://sigil-game-server.fly.dev/health
# → {"ok":true,"service":"sigil-game-server","ts":...}
```

**What works after this step:**
- Colyseus WebSocket rooms are running
- Health endpoint is reachable
- Game server is ready to accept connections — but the web app isn't deployed yet

---

## B. React Web App → Vercel (Vite + React)

```bash
cd web

# Deploy (Vercel reads web/vercel.json automatically)
vercel --prod
```

When the Vercel CLI asks about settings, accept defaults — `web/vercel.json` already specifies:
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- SPA rewrite: all routes → `/index.html` (React Router deep links work)

**Set these environment variables in the Vercel project dashboard**
(Project → Settings → Environment Variables):

| Variable | Value | Where to get it |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://nvosctybynqsjrfuvkek.supabase.co` | Copy from `web/supabase-config.js` or `web/.env.local` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (the public anon JWT) | Copy from `web/supabase-config.js` or `web/.env.local` — this is the **anon** key only, safe for the browser |
| `VITE_GAME_SERVER_URL` | `wss://sigil-game-server.fly.dev` | Output from step A |
| `VITE_VOICE_CHAT_ENABLED` | `true` | Optional — enables WebRTC mic button; requires TURN server (see §D) |
| `VITE_TURN_URL` | `turns:your-turn-server.com:443` | Optional — for voice over NAT |
| `VITE_TURN_USER` | `<turn username>` | Optional |
| `VITE_TURN_CRED` | `<turn credential>` | Optional |

After setting env vars, **redeploy** so they take effect:
```bash
vercel --prod
```

**What works after this step:**
- Full React app live at your Vercel URL
- Supabase auth (sign-up / sign-in / guest)
- Deck builder, precons, bracket scoring
- Solo tabletop (no server needed)
- Online tabletop — connects to Fly.io game server via `VITE_GAME_SERVER_URL`
- Match history + ELO writes to Supabase

---

## C. Go back and wire the two together

After Vercel gives you your production URL (e.g. `https://sigil-abc123.vercel.app`):

```bash
cd server
flyctl secrets set WEB_ORIGIN=https://sigil-abc123.vercel.app
flyctl deploy   # re-deploy to pick up the new CORS origin
```

Optionally add a custom domain to both Vercel and Fly via their dashboards.

---

## D. Remaining human gates

| Gate | Required for | How |
|---|---|---|
| **Supabase OAuth providers** | Google / Discord sign-in | Supabase dashboard → Auth → Providers → enable Google and/or Discord; paste client_id + secret |
| **TURN server** | Voice chat over NAT / symmetric firewalls | Provision a TURN server (Metered.ca free tier, Twilio, or self-host coturn); set the three `VITE_TURN_*` env vars in Vercel |
| **Live 2-browser multiplayer test** | Confirm game rooms work end-to-end | Open two browser tabs to `/lobby`, create a game, join from the second tab, play a few turns |
| **Custom domain** | Branding | Vercel + Fly both support `Add Domain` in their dashboards |
| **OpenRouter key** (optional) | Playmat image generation | Set as a Supabase secret: `supabase secrets set OPENROUTER_KEY=sk-...` |

---

## E. Vanilla app (root `vercel.json`) — keep separate

The root `vercel.json` deploys the **original vanilla JS life counter** as a static site.
It is a *different* Vercel project. Do not modify it. Deploy it (if you still want it live)
by running `vercel --prod` from the **repo root**, not from `web/`.

---

## Quick reference

```
Game server:  cd server && flyctl deploy
Web app:      cd web    && vercel --prod
Health check: curl https://sigil-game-server.fly.dev/health
Logs:         flyctl logs   (server)   |   vercel logs   (web)
```

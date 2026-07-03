# ── Sigil Game Server — Fly.io Dockerfile ──────────────────────────────────
# Build:  docker build -t sigil-server .
# Run:    docker run -p 2567:2567 sigil-server
#
# Fly.io sets PORT automatically; we default to 2567 if unset.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev=false

# ── Build stage ─────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production stage ────────────────────────────────────────────────────────
FROM node:20-slim AS prod
WORKDIR /app

# Copy prod deps (re-install prod-only to keep image lean)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
# PORT is injected by Fly at runtime; 2567 is the local default
EXPOSE 2567

CMD ["npm", "start"]

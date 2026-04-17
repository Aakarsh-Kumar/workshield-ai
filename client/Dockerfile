FROM node:20-alpine AS base

# ── Dependencies ───────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json bun.lockb* package-lock.json* ./
RUN \
    if [ -f bun.lockb ]; then npm install -g bun && bun install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

# ── Builder ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BACKEND_URL=http://backend:4000
ARG AI_SERVICE_URL=http://ai-service:5001
ARG NEXT_PUBLIC_API_BASE=/api
ARG NEXT_PUBLIC_AI_BASE=/ai

ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_URL=$BACKEND_URL
ENV AI_SERVICE_URL=$AI_SERVICE_URL
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_AI_BASE=$NEXT_PUBLIC_AI_BASE

RUN npm run build

# ── Runner ─────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_URL=http://backend:4000
ENV AI_SERVICE_URL=http://ai-service:5001
ENV NEXT_PUBLIC_API_BASE=/api
ENV NEXT_PUBLIC_AI_BASE=/ai

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# next.config.ts must have output: 'standalone'
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]

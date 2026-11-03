# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# --- deps ---
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Next's image optimiser gives up on upstreams after 7 s; ygopro.online takes 3-6 s per card art.
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# --- build ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next embute NEXT_PUBLIC_* no build — vêm do GitLab CI (--build-arg)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DISCORD_URL
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ARG NEXT_PUBLIC_CARD_ART_FETCH

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DISCORD_URL=$NEXT_PUBLIC_DISCORD_URL
ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ENV NEXT_PUBLIC_CARD_ART_FETCH=$NEXT_PUBLIC_CARD_ART_FETCH
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# --- runtime ---
# Node 24 for TransformStream's fix (nodejs/node#62036). Native code here is sharp, one N-API binary for any Node.
# ponytail: runtime only. Moving the stages above busts the cached `pnpm install`, and the runner can't finish a cold
# download. Move them to 24 once it can.
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5173
ENV HOSTNAME=0.0.0.0
# Explicit heap ceiling instead of V8's guess; keep it ~75% of the container's memory limit.
ENV NODE_OPTIONS=--max-old-space-size=768

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 5173

CMD ["node", "server.js"]
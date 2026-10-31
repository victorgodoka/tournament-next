# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# --- deps ---
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm's fetch timeout caps a whole tarball, not idle time, and `next` is 33 MB: the default 60 s fails on a slow runner.
RUN pnpm install --frozen-lockfile --fetch-timeout=600000

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
FROM base AS runner
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
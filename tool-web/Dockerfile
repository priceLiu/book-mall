FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate \
  && pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate \
  && pnpm run build:docker

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /bin/bash nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

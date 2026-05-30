FROM node:22-bookworm-slim AS base
ENV NODE_OPTIONS="--experimental-sqlite"
WORKDIR /app

# ── 上游 Vue（prompt-optimizer vendor）────────────────────────────────────
FROM base AS vendor-deps
WORKDIR /app/vendor
COPY prompt-optimizer/ ./
RUN corepack enable && corepack prepare pnpm@10.6.1 --activate \
  && CI=true pnpm install --frozen-lockfile --ignore-scripts

FROM vendor-deps AS vendor-build
ARG VITE_GATEWAY_WEB_ORIGIN=https://gateway.ai-code8.com
ENV VITE_PLATFORM_GATEWAY=1 \
    VITE_GATEWAY_WEB_ORIGIN=${VITE_GATEWAY_WEB_ORIGIN}
RUN pnpm build:core && pnpm build:ui && pnpm build:web

# ── Next.js 平台壳 ─────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate \
  && CI=true pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY . .
COPY --from=vendor-build /app/vendor/packages/web/dist ./public
# vendor 源码仅供 vendor-build 阶段；Next 构建勿纳入类型检查
RUN rm -rf ./prompt-optimizer
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate \
  && pnpm run build:docker

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /bin/bash nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && chown nextjs:nodejs docker-entrypoint.sh

USER nextjs
EXPOSE 3006
ENV PORT=3006
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]

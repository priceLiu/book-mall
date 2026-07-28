FROM node:22-bookworm-slim AS base
WORKDIR /app

# ── 上游 Vite（director-desk vendor）────────────────────────────────────────
FROM base AS vendor-build
WORKDIR /app/vendor
COPY director-desk/ ./
RUN CI=true npm install --no-audit --no-fund \
  && npm run build

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
COPY --from=vendor-build /app/vendor/dist ./public
# vendor 源码仅供 vendor-build 阶段；Next 构建勿纳入类型检查
RUN rm -rf ./director-desk
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
EXPOSE 3009
ENV PORT=3009
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]

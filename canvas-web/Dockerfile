FROM node:22-bookworm-slim AS base
ENV NODE_OPTIONS="--experimental-sqlite"
WORKDIR /app

# CloudBase 目标目录是 canvas-web/，构建上下文进不去仓库根的 shared/。
# package.json 的 file:../shared/* 在镜像里解析为 /shared/*，故把快照拷到该路径。
# 刷新快照（改 shared/ 后、发版前）：
#   cp -R ../shared/federated-portal-nav ../shared/platform-assistant docker-shared/
FROM base AS with-shared
COPY docker-shared/federated-portal-nav /shared/federated-portal-nav
COPY docker-shared/platform-assistant /shared/platform-assistant

FROM with-shared AS deps
# pnpm-workspace.yaml 含 allowBuilds: unrs-resolver；不拷会触发 ERR_PNPM_IGNORED_BUILDS
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate \
  && CI=true pnpm install --frozen-lockfile --ignore-scripts

FROM with-shared AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY . .
RUN mkdir -p public
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
EXPOSE 3004
ENV PORT=3004
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]

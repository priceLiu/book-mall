# Prisma 6.19+ 需要 node:sqlite（Node 22.5+，实验开关见 NODE_OPTIONS）
FROM node:22-bookworm-slim AS base
ENV NODE_OPTIONS="--experimental-sqlite"
# fonts-wqy-microhei：烧录中文字幕；仅装 ffmpeg 时 libass 默认 Arial，中文会变成空心方框
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg fontconfig fonts-wqy-microhei \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# CloudBase 目标目录是 book-mall/，构建上下文进不去仓库根的 shared/。
# package.json 的 file:../shared/* 在镜像里解析为 /shared/*，故把快照拷到该路径。
# 刷新快照（改 shared/ 后、发版前）：
#   cp -R ../shared/federated-portal-nav ../shared/platform-assistant docker-shared/
FROM base AS with-shared
COPY docker-shared/federated-portal-nav /shared/federated-portal-nav
COPY docker-shared/media-render-subtitle-style /shared/media-render-subtitle-style
COPY docker-shared/platform-assistant /shared/platform-assistant

FROM with-shared AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# postinstall 会跑 prisma generate；schema 须先于 install 拷入
COPY prisma ./prisma
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate \
  && CI=true pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm exec prisma generate

FROM with-shared AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
# CloudBase 构建机内存偏小：限制 Next 并行 worker，并抬高 Node 堆上限，避免 OOM 导致 create_build_image 无日志失败
ENV NODE_OPTIONS="--experimental-sqlite --max-old-space-size=4096"
ENV NEXT_BUILD_WORKERS=1
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate \
  && pnpm exec next build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# 与 lockfile 中 @prisma/client 解析版本保持一致，便于 migrate
RUN npm install -g prisma@6.19.3 \
  && npm cache clean --force

RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /bin/bash nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs certs/wechat_pay_pub_key.pem ./certs/wechat_pay_pub_key.pem

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && chown nextjs:nodejs docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]

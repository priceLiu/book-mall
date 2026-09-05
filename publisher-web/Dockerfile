FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY publisher-web/package.json publisher-web/pnpm-lock.yaml* ./
COPY shared/federated-portal-nav ../shared/federated-portal-nav
COPY shared/publisher-client ../shared/publisher-client
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY publisher-web .
COPY shared/federated-portal-nav ../shared/federated-portal-nav
COPY shared/publisher-client ../shared/publisher-client
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3011
EXPOSE 3011
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
CMD ["node", "server.js"]

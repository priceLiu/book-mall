#!/bin/sh
set -e

# 生产：将仍为云托管默认域或留空的 Origin 纠正为正式 book / tool 域名（与 lib/production-origin.ts 一致）。
# 设 ALLOW_CLOUDBASE_DEFAULT_ORIGINS=1 可保留控制台里的 *.sh.run 地址。本地 pnpm dev 不经过此脚本。
if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${NEXTAUTH_URL:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXTAUTH_URL="https://book.ai-code8.com"
      echo "[book-mall] NEXTAUTH_URL -> ${NEXTAUTH_URL}"
      ;;
  esac
  case "${TOOLS_PUBLIC_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export TOOLS_PUBLIC_ORIGIN="https://tool.ai-code8.com"
      echo "[book-mall] TOOLS_PUBLIC_ORIGIN -> ${TOOLS_PUBLIC_ORIGIN}"
      ;;
  esac
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[book-mall] ERROR: DATABASE_URL 未设置，无法执行 prisma migrate deploy"
  exit 1
fi
echo "[book-mall] Running prisma migrate deploy..."
prisma migrate deploy
exec node server.js

#!/bin/sh
set -e

# 生产镜像默认公网域名（云托管可在控制台覆盖）。本地开发使用 pnpm dev + .env.local，不经过本脚本。
if [ "$NODE_ENV" = "production" ]; then
  if [ -z "${NEXTAUTH_URL:-}" ]; then
    export NEXTAUTH_URL="https://book.ai-code8.com"
    echo "[book-mall] NEXTAUTH_URL 未设置，使用默认 ${NEXTAUTH_URL}"
  fi
  if [ -z "${TOOLS_PUBLIC_ORIGIN:-}" ]; then
    export TOOLS_PUBLIC_ORIGIN="https://tool.ai-code8.com"
    echo "[book-mall] TOOLS_PUBLIC_ORIGIN 未设置，使用默认 ${TOOLS_PUBLIC_ORIGIN}"
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[book-mall] ERROR: DATABASE_URL 未设置，无法执行 prisma migrate deploy"
  exit 1
fi
echo "[book-mall] Running prisma migrate deploy..."
prisma migrate deploy
exec node server.js

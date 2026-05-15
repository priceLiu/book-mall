#!/bin/sh
set -e

# 生产镜像默认公网域名（云托管可在控制台覆盖）。本地开发使用 pnpm dev + .env.local，不经过本脚本。
if [ "$NODE_ENV" = "production" ]; then
  if [ -z "${MAIN_SITE_ORIGIN:-}" ]; then
    export MAIN_SITE_ORIGIN="https://book.ai-code8.com"
    echo "[tool-web] MAIN_SITE_ORIGIN 未设置，使用默认 ${MAIN_SITE_ORIGIN}"
  fi
  if [ -z "${TOOLS_PUBLIC_ORIGIN:-}" ]; then
    export TOOLS_PUBLIC_ORIGIN="https://tool.ai-code8.com"
    echo "[tool-web] TOOLS_PUBLIC_ORIGIN 未设置，使用默认 ${TOOLS_PUBLIC_ORIGIN}"
  fi
fi

exec node server.js

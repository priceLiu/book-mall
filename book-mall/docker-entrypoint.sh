#!/bin/sh
set -e

# 生产：将仍为云托管默认域、留空或误填 http:// 的 Origin 纠正为正式 HTTPS 域名。
# 设 ALLOW_CLOUDBASE_DEFAULT_ORIGINS=1 可保留控制台里的 *.sh.run 地址。本地 pnpm dev 不经过此脚本。
patch_origin_env() {
  key="$1"
  canon="$2"
  eval val=\$$key
  case "$val" in
    ""|*"sh.run.tcloudbase.com"*)
      export "$key=$canon"
      echo "[book-mall] $key -> $canon"
      ;;
    http://*ai-code8.com*)
      fixed=$(printf '%s' "$val" | sed 's|^http://|https://|')
      export "$key=$fixed"
      echo "[book-mall] $key -> $fixed (http→https)"
      ;;
  esac
}

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  patch_origin_env NEXTAUTH_URL "https://book.ai-code8.com"
  patch_origin_env TOOLS_PUBLIC_ORIGIN "https://tool.ai-code8.com"
  patch_origin_env NEXT_PUBLIC_FINANCE_WEB_ORIGIN "https://f.ai-code8.com"
  patch_origin_env FINANCE_WEB_ORIGINS "https://f.ai-code8.com"
  patch_origin_env NEXT_PUBLIC_STORY_WEB_ORIGIN "https://story.ai-code8.com"
  patch_origin_env STORY_WEB_ORIGINS "https://story.ai-code8.com"
  patch_origin_env NEXT_PUBLIC_CANVAS_WEB_ORIGIN "https://canvas.ai-code8.com"
  patch_origin_env CANVAS_WEB_ORIGINS "https://canvas.ai-code8.com"
  patch_origin_env NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN "https://prompt.ai-code8.com"
  patch_origin_env PROMPT_OPTIMIZER_PUBLIC_ORIGIN "https://prompt.ai-code8.com"
  case "${NEXTAUTH_COOKIE_DOMAIN:-}" in
    "")
      export NEXTAUTH_COOKIE_DOMAIN=".ai-code8.com"
      echo "[book-mall] NEXTAUTH_COOKIE_DOMAIN -> ${NEXTAUTH_COOKIE_DOMAIN}"
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

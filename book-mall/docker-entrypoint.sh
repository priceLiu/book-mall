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

if [ -z "$DIRECT_DATABASE_URL" ]; then
  export DIRECT_DATABASE_URL="$DATABASE_URL"
  echo "[book-mall] DIRECT_DATABASE_URL 未设置，迁移将使用 DATABASE_URL（直连库时与显式配置等效）"
  case "$DATABASE_URL" in
    *pgbouncer=true*)
      echo "[book-mall] WARNING: DATABASE_URL 含 pgbouncer=true，请在环境变量中单独配置 DIRECT_DATABASE_URL 直连 CDB"
      ;;
  esac
fi

# 生产默认不在容器启动时跑迁移（大表 DDL 会阻塞 3000 探针）。发版前由运维/Agent 执行 pnpm db:deploy。
# 本地 compose / 非 production 仍自动 migrate；生产需显式 PRISMA_MIGRATE_ON_START=1 才在启动时 migrate。
should_migrate=0
if [ "$NODE_ENV" != "production" ]; then
  should_migrate=1
fi
if [ "${PRISMA_MIGRATE_ON_START:-}" = "1" ]; then
  should_migrate=1
fi
if [ "${SKIP_PRISMA_MIGRATE_ON_START:-}" = "1" ]; then
  should_migrate=0
fi
if [ "$should_migrate" = "1" ]; then
  echo "[book-mall] Running prisma migrate deploy..."
  prisma migrate deploy
else
  echo "[book-mall] Skipping prisma migrate deploy on start (run pnpm db:deploy before release)"
fi
exec node server.js

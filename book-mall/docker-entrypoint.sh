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
  case "${NEXT_PUBLIC_FINANCE_WEB_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_FINANCE_WEB_ORIGIN="https://f.ai-code8.com"
      echo "[book-mall] NEXT_PUBLIC_FINANCE_WEB_ORIGIN -> ${NEXT_PUBLIC_FINANCE_WEB_ORIGIN}"
      ;;
  esac
  case "${FINANCE_WEB_ORIGINS:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export FINANCE_WEB_ORIGINS="https://f.ai-code8.com"
      echo "[book-mall] FINANCE_WEB_ORIGINS -> ${FINANCE_WEB_ORIGINS}"
      ;;
  esac
  case "${NEXT_PUBLIC_STORY_WEB_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_STORY_WEB_ORIGIN="https://story.ai-code8.com"
      echo "[book-mall] NEXT_PUBLIC_STORY_WEB_ORIGIN -> ${NEXT_PUBLIC_STORY_WEB_ORIGIN}"
      ;;
  esac
  case "${STORY_WEB_ORIGINS:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export STORY_WEB_ORIGINS="https://story.ai-code8.com"
      echo "[book-mall] STORY_WEB_ORIGINS -> ${STORY_WEB_ORIGINS}"
      ;;
  esac
  case "${NEXT_PUBLIC_CANVAS_WEB_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_CANVAS_WEB_ORIGIN="https://canvas.ai-code8.com"
      echo "[book-mall] NEXT_PUBLIC_CANVAS_WEB_ORIGIN -> ${NEXT_PUBLIC_CANVAS_WEB_ORIGIN}"
      ;;
  esac
  case "${CANVAS_WEB_ORIGINS:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export CANVAS_WEB_ORIGINS="https://canvas.ai-code8.com"
      echo "[book-mall] CANVAS_WEB_ORIGINS -> ${CANVAS_WEB_ORIGINS}"
      ;;
  esac
  case "${NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN="https://prompt.ai-code8.com"
      echo "[book-mall] NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN -> ${NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN}"
      ;;
  esac
  case "${PROMPT_OPTIMIZER_PUBLIC_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export PROMPT_OPTIMIZER_PUBLIC_ORIGIN="https://prompt.ai-code8.com"
      echo "[book-mall] PROMPT_OPTIMIZER_PUBLIC_ORIGIN -> ${PROMPT_OPTIMIZER_PUBLIC_ORIGIN}"
      ;;
  esac
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

#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${NEXT_PUBLIC_BOOK_MALL_URL:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_BOOK_MALL_URL="https://book.ai-code8.com"
      echo "[story-web] NEXT_PUBLIC_BOOK_MALL_URL -> ${NEXT_PUBLIC_BOOK_MALL_URL}"
      ;;
  esac
  export BOOK_MALL_URL="${BOOK_MALL_URL:-$NEXT_PUBLIC_BOOK_MALL_URL}"
  export MAIN_SITE_ORIGIN="${MAIN_SITE_ORIGIN:-$BOOK_MALL_URL}"
  case "${NEXT_PUBLIC_STORY_WEB_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_STORY_WEB_ORIGIN="https://story.ai-code8.com"
      echo "[story-web] NEXT_PUBLIC_STORY_WEB_ORIGIN -> ${NEXT_PUBLIC_STORY_WEB_ORIGIN}"
      ;;
  esac
  export STORY_PUBLIC_ORIGIN="${STORY_PUBLIC_ORIGIN:-$NEXT_PUBLIC_STORY_WEB_ORIGIN}"
fi

sso_secret="${TOOLS_SSO_SERVER_SECRET:-}"
if [ -z "$sso_secret" ] || [ "${#sso_secret}" -lt 16 ]; then
  echo "[story-web] ERROR: TOOLS_SSO_SERVER_SECRET 未设置或不足 16 字符。"
  echo "[story-web]         须与 book-mall 云托管环境变量完全一致，否则 SSO 会报 missing_exchange_secret。"
  exit 1
fi
jwt_secret="${TOOLS_SSO_JWT_SECRET:-}"
if [ -z "$jwt_secret" ] || [ "${#jwt_secret}" -lt 16 ]; then
  echo "[story-web] ERROR: TOOLS_SSO_JWT_SECRET 未设置或不足 16 字符（须与 book-mall 一致）。"
  exit 1
fi

exec node server.js

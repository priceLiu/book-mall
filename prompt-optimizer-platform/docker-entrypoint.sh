#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${BOOK_MALL_URL:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export BOOK_MALL_URL="https://book.ai-code8.com"
      export NEXT_PUBLIC_BOOK_MALL_URL="${BOOK_MALL_URL}"
      export MAIN_SITE_ORIGIN="${BOOK_MALL_URL}"
      echo "[prompt-optimizer-platform] BOOK_MALL_URL -> ${BOOK_MALL_URL}"
      ;;
  esac
  case "${PROMPT_OPTIMIZER_PUBLIC_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export PROMPT_OPTIMIZER_PUBLIC_ORIGIN="https://prompt.ai-code8.com"
      export NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN="${PROMPT_OPTIMIZER_PUBLIC_ORIGIN}"
      echo "[prompt-optimizer-platform] PROMPT_OPTIMIZER_PUBLIC_ORIGIN -> ${PROMPT_OPTIMIZER_PUBLIC_ORIGIN}"
      ;;
  esac
  case "${NEXT_PUBLIC_GATEWAY_WEB_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_GATEWAY_WEB_ORIGIN="https://gateway.ai-code8.com"
      echo "[prompt-optimizer-platform] NEXT_PUBLIC_GATEWAY_WEB_ORIGIN -> ${NEXT_PUBLIC_GATEWAY_WEB_ORIGIN}"
      ;;
  esac
fi

sso_secret="${TOOLS_SSO_SERVER_SECRET:-}"
if [ -z "$sso_secret" ] || [ "${#sso_secret}" -lt 16 ]; then
  echo "[prompt-optimizer-platform] ERROR: TOOLS_SSO_SERVER_SECRET 未设置或不足 16 字符。"
  echo "[prompt-optimizer-platform]         须与 book-mall 云托管环境变量完全一致，否则 SSO 会报 exchange_401。"
  exit 1
fi
jwt_secret="${TOOLS_SSO_JWT_SECRET:-}"
if [ -z "$jwt_secret" ] || [ "${#jwt_secret}" -lt 16 ]; then
  echo "[prompt-optimizer-platform] ERROR: TOOLS_SSO_JWT_SECRET 未设置或不足 16 字符（须与 book-mall 一致）。"
  exit 1
fi

exec node server.js

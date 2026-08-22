#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${NEXT_PUBLIC_BOOK_MALL_URL:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_BOOK_MALL_URL="https://book.ai-code8.com"
      echo "[common-tools] NEXT_PUBLIC_BOOK_MALL_URL -> ${NEXT_PUBLIC_BOOK_MALL_URL}"
      ;;
  esac
  export BOOK_MALL_URL="${BOOK_MALL_URL:-$NEXT_PUBLIC_BOOK_MALL_URL}"
  export MAIN_SITE_ORIGIN="${MAIN_SITE_ORIGIN:-$BOOK_MALL_URL}"

  case "${NEXT_PUBLIC_COMMON_TOOLS_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*|*"common.ai-code8.com"*)
      export NEXT_PUBLIC_COMMON_TOOLS_ORIGIN="https://com.ai-code8.com"
      echo "[common-tools] NEXT_PUBLIC_COMMON_TOOLS_ORIGIN -> ${NEXT_PUBLIC_COMMON_TOOLS_ORIGIN}"
      ;;
  esac
  export COMMON_TOOLS_PUBLIC_ORIGIN="${COMMON_TOOLS_PUBLIC_ORIGIN:-$NEXT_PUBLIC_COMMON_TOOLS_ORIGIN}"
fi

main_origin="${MAIN_SITE_ORIGIN:-${BOOK_MALL_URL:-${NEXT_PUBLIC_BOOK_MALL_URL:-}}}"
if [ -z "$main_origin" ]; then
  echo "[common-tools] ERROR: MAIN_SITE_ORIGIN / BOOK_MALL_URL / NEXT_PUBLIC_BOOK_MALL_URL 均未设置。"
  exit 1
fi
export MAIN_SITE_ORIGIN="${MAIN_SITE_ORIGIN:-$main_origin}"

sso_secret="${TOOLS_SSO_SERVER_SECRET:-}"
if [ -z "$sso_secret" ] || [ "${#sso_secret}" -lt 16 ]; then
  echo "[common-tools] ERROR: TOOLS_SSO_SERVER_SECRET 未设置或不足 16 字符。"
  exit 1
fi
jwt_secret="${TOOLS_SSO_JWT_SECRET:-}"
if [ -z "$jwt_secret" ] || [ "${#jwt_secret}" -lt 16 ]; then
  echo "[common-tools] ERROR: TOOLS_SSO_JWT_SECRET 未设置或不足 16 字符。"
  exit 1
fi

exec node server.js

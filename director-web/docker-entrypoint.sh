#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${BOOK_MALL_URL:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export BOOK_MALL_URL="https://book.ai-code8.com"
      export NEXT_PUBLIC_BOOK_MALL_URL="${BOOK_MALL_URL}"
      export MAIN_SITE_ORIGIN="${BOOK_MALL_URL}"
      echo "[director-web] BOOK_MALL_URL -> ${BOOK_MALL_URL}"
      ;;
  esac
  case "${DIRECTOR_WEB_PUBLIC_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export DIRECTOR_WEB_PUBLIC_ORIGIN="https://director.ai-code8.com"
      export NEXT_PUBLIC_DIRECTOR_WEB_ORIGIN="${DIRECTOR_WEB_PUBLIC_ORIGIN}"
      echo "[director-web] DIRECTOR_WEB_PUBLIC_ORIGIN -> ${DIRECTOR_WEB_PUBLIC_ORIGIN}"
      ;;
  esac
  case "${NEXT_PUBLIC_CANVAS_WEB_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_CANVAS_WEB_ORIGIN="https://canvas.ai-code8.com"
      echo "[director-web] NEXT_PUBLIC_CANVAS_WEB_ORIGIN -> ${NEXT_PUBLIC_CANVAS_WEB_ORIGIN}"
      ;;
  esac
fi

sso_secret="${TOOLS_SSO_SERVER_SECRET:-}"
if [ -z "$sso_secret" ] || [ "${#sso_secret}" -lt 16 ]; then
  echo "[director-web] ERROR: TOOLS_SSO_SERVER_SECRET 未设置或不足 16 字符（须与 book-mall 一致，否则 SSO exchange_401）。"
  exit 1
fi
jwt_secret="${TOOLS_SSO_JWT_SECRET:-}"
if [ -z "$jwt_secret" ] || [ "${#jwt_secret}" -lt 16 ]; then
  echo "[director-web] ERROR: TOOLS_SSO_JWT_SECRET 未设置或不足 16 字符（须与 book-mall 一致）。"
  exit 1
fi

exec node server.js

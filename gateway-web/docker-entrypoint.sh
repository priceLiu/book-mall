#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${BOOK_MALL_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export BOOK_MALL_ORIGIN="https://book.ai-code8.com"
      echo "[gateway-web] BOOK_MALL_ORIGIN -> ${BOOK_MALL_ORIGIN}"
      ;;
  esac
  case "${NEXT_PUBLIC_BOOK_MALL_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_BOOK_MALL_ORIGIN="${BOOK_MALL_ORIGIN:-https://book.ai-code8.com}"
      echo "[gateway-web] NEXT_PUBLIC_BOOK_MALL_ORIGIN -> ${NEXT_PUBLIC_BOOK_MALL_ORIGIN}"
      ;;
  esac
  case "${GATEWAY_PUBLIC_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export GATEWAY_PUBLIC_ORIGIN="https://gateway.ai-code8.com"
      echo "[gateway-web] GATEWAY_PUBLIC_ORIGIN -> ${GATEWAY_PUBLIC_ORIGIN}"
      ;;
  esac
fi

exec node server.js

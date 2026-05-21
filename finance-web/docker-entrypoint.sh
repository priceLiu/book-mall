#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${NEXT_PUBLIC_BOOK_MALL_URL:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_BOOK_MALL_URL="https://book.ai-code8.com"
      echo "[finance-web] NEXT_PUBLIC_BOOK_MALL_URL -> ${NEXT_PUBLIC_BOOK_MALL_URL}"
      ;;
  esac
fi

exec node server.js

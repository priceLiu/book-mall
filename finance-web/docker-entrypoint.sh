#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${BOOK_MALL_BILLING_INTERNAL_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export BOOK_MALL_BILLING_INTERNAL_ORIGIN="https://book.ai-code8.com"
      echo "[finance-web] BOOK_MALL_BILLING_INTERNAL_ORIGIN -> ${BOOK_MALL_BILLING_INTERNAL_ORIGIN}"
      ;;
  esac
fi

exec node server.js

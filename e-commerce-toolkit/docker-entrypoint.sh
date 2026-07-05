#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${NEXT_PUBLIC_BOOK_MALL_URL:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_BOOK_MALL_URL="https://book.ai-code8.com"
      echo "[e-commerce-toolkit] NEXT_PUBLIC_BOOK_MALL_URL -> ${NEXT_PUBLIC_BOOK_MALL_URL}"
      ;;
  esac
  export BOOK_MALL_URL="${BOOK_MALL_URL:-$NEXT_PUBLIC_BOOK_MALL_URL}"
  export MAIN_SITE_ORIGIN="${MAIN_SITE_ORIGIN:-$BOOK_MALL_URL}"

  case "${NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN="https://ecom.ai-code8.com"
      echo "[e-commerce-toolkit] NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN -> ${NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN}"
      ;;
  esac
  export ECOMMERCE_PUBLIC_ORIGIN="${ECOMMERCE_PUBLIC_ORIGIN:-$NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN}"
fi

main_origin="${MAIN_SITE_ORIGIN:-${BOOK_MALL_URL:-${NEXT_PUBLIC_BOOK_MALL_URL:-}}}"
if [ -z "$main_origin" ]; then
  echo "[e-commerce-toolkit] ERROR: MAIN_SITE_ORIGIN / BOOK_MALL_URL / NEXT_PUBLIC_BOOK_MALL_URL 均未设置。"
  echo "[e-commerce-toolkit]         SSO 换票会报 missing_main_origin。见 deploy/tencent/e-commerce-toolkit.env.example"
  exit 1
fi
export MAIN_SITE_ORIGIN="${MAIN_SITE_ORIGIN:-$main_origin}"

sso_secret="${TOOLS_SSO_SERVER_SECRET:-}"
if [ -z "$sso_secret" ] || [ "${#sso_secret}" -lt 16 ]; then
  echo "[e-commerce-toolkit] ERROR: TOOLS_SSO_SERVER_SECRET 未设置或不足 16 字符。"
  echo "[e-commerce-toolkit]         须与 book-mall 云托管环境变量完全一致。"
  exit 1
fi
jwt_secret="${TOOLS_SSO_JWT_SECRET:-}"
if [ -z "$jwt_secret" ] || [ "${#jwt_secret}" -lt 16 ]; then
  echo "[e-commerce-toolkit] ERROR: TOOLS_SSO_JWT_SECRET 未设置或不足 16 字符（须与 book-mall 一致）。"
  exit 1
fi

exec node server.js

#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  patch_origin_env() {
    key="$1"
    canon="$2"
    eval val=\$$key
    case "$val" in
      ""|*"sh.run.tcloudbase.com"*)
        export "$key=$canon"
        echo "[canvas-web] $key -> $canon"
        ;;
      http://*ai-code8.com*)
        fixed=$(printf '%s' "$val" | sed 's|^http://|https://|')
        export "$key=$fixed"
        echo "[canvas-web] $key -> $fixed (http→https)"
        ;;
    esac
  }
  patch_origin_env NEXT_PUBLIC_BOOK_MALL_URL "https://book.ai-code8.com"
  export BOOK_MALL_URL="${BOOK_MALL_URL:-$NEXT_PUBLIC_BOOK_MALL_URL}"
  export MAIN_SITE_ORIGIN="${MAIN_SITE_ORIGIN:-$BOOK_MALL_URL}"
  patch_origin_env NEXT_PUBLIC_CANVAS_WEB_ORIGIN "https://canvas.ai-code8.com"
  export CANVAS_PUBLIC_ORIGIN="${CANVAS_PUBLIC_ORIGIN:-$NEXT_PUBLIC_CANVAS_WEB_ORIGIN}"
  patch_origin_env NEXT_PUBLIC_TOOL_WEB_ORIGIN "https://tool.ai-code8.com"
fi

sso_secret="${TOOLS_SSO_SERVER_SECRET:-}"
if [ -z "$sso_secret" ] || [ "${#sso_secret}" -lt 16 ]; then
  echo "[canvas-web] ERROR: TOOLS_SSO_SERVER_SECRET 未设置或不足 16 字符。"
  echo "[canvas-web]         须与 book-mall 云托管环境变量完全一致，否则 SSO 会报 exchange_401。"
  exit 1
fi
jwt_secret="${TOOLS_SSO_JWT_SECRET:-}"
if [ -z "$jwt_secret" ] || [ "${#jwt_secret}" -lt 16 ]; then
  echo "[canvas-web] ERROR: TOOLS_SSO_JWT_SECRET 未设置或不足 16 字符（须与 book-mall 一致）。"
  exit 1
fi

exec node server.js

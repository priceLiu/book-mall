#!/bin/sh
set -e

patch_origin_env() {
  key="$1"
  canon="$2"
  eval val=\$$key
  case "$val" in
    ""|*"sh.run.tcloudbase.com"*)
      export "$key=$canon"
      echo "[tool-web] $key -> $canon"
      ;;
    http://*ai-code8.com*)
      fixed=$(printf '%s' "$val" | sed 's|^http://|https://|')
      export "$key=$fixed"
      echo "[tool-web] $key -> $fixed (http→https)"
      ;;
  esac
}

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  patch_origin_env MAIN_SITE_ORIGIN "https://book.ai-code8.com"
  patch_origin_env TOOLS_PUBLIC_ORIGIN "https://tool.ai-code8.com"
fi

exec node server.js

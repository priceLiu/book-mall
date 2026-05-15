#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ] && [ "${ALLOW_CLOUDBASE_DEFAULT_ORIGINS:-}" != "1" ]; then
  case "${MAIN_SITE_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export MAIN_SITE_ORIGIN="https://book.ai-code8.com"
      echo "[tool-web] MAIN_SITE_ORIGIN -> ${MAIN_SITE_ORIGIN}"
      ;;
  esac
  case "${TOOLS_PUBLIC_ORIGIN:-}" in
    ""|*"sh.run.tcloudbase.com"*)
      export TOOLS_PUBLIC_ORIGIN="https://tool.ai-code8.com"
      echo "[tool-web] TOOLS_PUBLIC_ORIGIN -> ${TOOLS_PUBLIC_ORIGIN}"
      ;;
  esac
fi

exec node server.js

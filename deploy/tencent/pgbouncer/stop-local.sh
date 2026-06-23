#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
LOCAL_PID="/tmp/tool-mall-pgbouncer.pid"
if docker info >/dev/null 2>&1 && docker compose ps -q pgbouncer 2>/dev/null | grep -q .; then
  docker compose down
  echo "Docker PgBouncer 已停止。"
fi
if [[ -f "$LOCAL_PID" ]] && kill -0 "$(cat "$LOCAL_PID")" 2>/dev/null; then
  kill "$(cat "$LOCAL_PID")"
  rm -f "$LOCAL_PID"
  echo "本机 PgBouncer 已停止。"
else
  echo "PgBouncer 未在运行。"
fi
echo "若要回退直连，把 book-mall/.env.local 的 DATABASE_URL 改回 CDB:24155。"

#!/usr/bin/env bash
# 腾讯云 PostgreSQL 逻辑备份（迁移前执行）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/book-mall/.env.local"
OUT_DIR="$ROOT/backup"
mkdir -p "$OUT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL 未设置"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M)"
OUT="$OUT_DIR/pre-gateway-$STAMP.dump"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" -Fc -f "$OUT"
  echo "已备份: $OUT ($(du -h "$OUT" | cut -f1))"
else
  echo "pg_dump 未安装。请："
  echo "  1) brew install libpq && export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
  echo "  2) 或在腾讯云控制台 → PostgreSQL → 手动备份"
  exit 1
fi
